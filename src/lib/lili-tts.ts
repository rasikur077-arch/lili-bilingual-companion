import { useSyncExternalStore } from "react";

/**
 * Free read-aloud for Lili's replies using the browser's built-in
 * SpeechSynthesis (no API, no key). One global controller guarantees only a
 * single reply is spoken at a time. Text is spoken sentence-by-sentence so
 * Pause/Resume works on Android Chrome (where native pause() is unreliable)
 * and long replies don't get cut off by Chrome's ~15s utterance limit.
 */

export type SpeechLang = "bn" | "en";
export type SpeechChunk = { text: string; lang: SpeechLang };
export type VoiceLike = { lang: string; name: string; default?: boolean; localService?: boolean };

const BENGALI_LETTER = /[\u0980-\u09FF]/;
const MAX_CHUNK = 180;

/** Removes Markdown symbols and emoji so the voice reads only the words. */
export function cleanForSpeech(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n?/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-*:?\s*\|?\s*$/gm, "")
    .replace(/\s*\|\s*/g, ", ")
    .replace(/(\*\*|__|~~|\*)/g, "")
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Any Bengali letter makes the sentence Bangla: Bangla voices also read English words. */
export function detectLang(text: string): SpeechLang {
  return BENGALI_LETTER.test(text) ? "bn" : "en";
}

function splitLong(sentence: string): string[] {
  if (sentence.length <= MAX_CHUNK) return [sentence];
  const out: string[] = [];
  let rest = sentence;
  while (rest.length > MAX_CHUNK) {
    const window = rest.slice(0, MAX_CHUNK);
    let cut = Math.max(window.lastIndexOf(","), window.lastIndexOf("،"), window.lastIndexOf(";"));
    if (cut < MAX_CHUNK / 3) cut = window.lastIndexOf(" ");
    if (cut < MAX_CHUNK / 3) cut = MAX_CHUNK - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Splits a reply into short, single-language pieces in reading order. */
export function splitSpeechChunks(markdown: string): SpeechChunk[] {
  const text = cleanForSpeech(markdown);
  const sentences = text
    .split(/(?<=[।!?.…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));

  const chunks: SpeechChunk[] = [];
  for (const sentence of sentences) {
    const lang = detectLang(sentence);
    for (const piece of splitLong(sentence)) {
      const prev = chunks.at(-1);
      if (prev && prev.lang === lang && prev.text.length + piece.length + 1 <= MAX_CHUNK) {
        prev.text = `${prev.text} ${piece}`;
      } else {
        chunks.push({ text: piece, lang });
      }
    }
  }
  return chunks;
}

const normLang = (l: string) => l.replace(/_/g, "-").toLowerCase();

/**
 * Best installed voice for a language. Bangla prefers Bangladesh (bn-BD),
 * then India (bn-IN), then any Bengali voice. Returns null when none exists.
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: SpeechLang): V | null {
  const prefs = lang === "bn" ? ["bn-bd", "bn-in", "bn"] : ["en-us", "en-gb", "en-in", "en"];
  for (const pref of prefs) {
    const matches = voices.filter((v) => {
      const l = normLang(v.lang);
      return pref.length === 2 ? l === pref || l.startsWith(`${pref}-`) : l === pref;
    });
    if (matches.length) return matches.find((v) => v.localService) ?? matches[0] ?? null;
  }
  if (lang === "bn") {
    return voices.find((v) => /bangla|bengali|বাংলা/i.test(v.name)) ?? null;
  }
  return null;
}

// ---------- Global controller ----------

export type SpeakStatus = "idle" | "speaking" | "paused";
export type SpeakState = { activeId: string | null; status: SpeakStatus };
type PlannedChunk = SpeechChunk & { voice: SpeechSynthesisVoice | null };
type Notify = (message: string) => void;

const IDLE: SpeakState = { activeId: null, status: "idle" };
let state: SpeakState = IDLE;
const listeners = new Set<() => void>();
let chunks: PlannedChunk[] = [];
let index = 0;
let generation = 0;
// Strong reference: Chrome drops events for garbage-collected utterances.
let current: SpeechSynthesisUtterance | null = null;
let notify: Notify = () => {};
let banglaWarned = false;

const setState = (next: SpeakState) => {
  state = next;
  listeners.forEach((l) => l());
};

export function isSpeechSupported() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined"
  );
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const ready = synth.getVoices();
  if (ready.length) return Promise.resolve(ready);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener?.("voiceschanged", done);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, 1500);
    synth.addEventListener?.("voiceschanged", done);
  });
}

/** Call on screen mount so voices are ready before the first tap (Android loads them lazily). */
export function warmUpVoices() {
  if (isSpeechSupported()) void loadVoices();
}

function cancelSynth() {
  current = null;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

function speakChunk(gen: number) {
  if (gen !== generation) return;
  const chunk = chunks[index];
  if (!chunk) {
    current = null;
    chunks = [];
    index = 0;
    setState(IDLE);
    return;
  }
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(chunk.text);
  u.lang = chunk.voice?.lang.replace(/_/g, "-") ?? (chunk.lang === "bn" ? "bn-BD" : "en-US");
  if (chunk.voice) u.voice = chunk.voice;
  u.rate = chunk.lang === "bn" ? 0.95 : 1;
  u.pitch = 1.05;
  u.onend = () => {
    if (gen !== generation || current !== u) return;
    index += 1;
    speakChunk(gen);
  };
  u.onerror = (e) => {
    if (gen !== generation || current !== u) return;
    if (e.error === "interrupted" || e.error === "canceled") return;
    if (e.error === "language-unavailable" || e.error === "voice-unavailable") {
      if (chunk.lang === "bn") {
        notify(
          "This device can't speak Bangla yet. On Android: Settings → Text-to-speech → Google → install Bengali (Bangladesh). (বাংলা ভয়েস ইনস্টল করুন।)",
        );
      }
      index += 1; // skip what can't be read, keep going
      speakChunk(gen);
      return;
    }
    stopSpeaking();
    notify(
      e.error === "not-allowed"
        ? "Your browser blocked read-aloud. Tap the speaker button again."
        : "Couldn't read this reply aloud. Please try again. (পড়ে শোনানো যায়নি।)",
    );
  };
  current = u;
  // Android Chrome can get stuck "paused" after cancel; nudge it.
  if (synth.paused) synth.resume();
  synth.speak(u);
}

/** Starts reading a reply aloud. Any other reply that is speaking is stopped first. */
export async function speakReply(id: string, text: string, onNotice: Notify) {
  if (!isSpeechSupported()) {
    onNotice("Read-aloud isn't supported in this browser. Try Chrome on Android.");
    return;
  }
  cancelSynth();
  notify = onNotice;
  const gen = ++generation;
  chunks = [];
  index = 0;
  setState({ activeId: id, status: "speaking" });

  const voices = await loadVoices();
  if (gen !== generation) return;

  const bnVoice = pickVoice(voices, "bn");
  const enVoice = pickVoice(voices, "en");
  chunks = splitSpeechChunks(text).map((c) => ({ ...c, voice: c.lang === "bn" ? bnVoice : enVoice }));
  if (!chunks.length) {
    setState(IDLE);
    return;
  }
  if (!bnVoice && chunks.some((c) => c.lang === "bn") && !banglaWarned) {
    banglaWarned = true;
    onNotice(
      "No Bangla voice found on this device, so Lili will try the default voice. For clear Bangla on Android: Settings → Text-to-speech → Google → install Bengali (Bangladesh).",
    );
  }
  // Small delay after cancel(): Android Chrome drops a speak() issued immediately after it.
  setTimeout(() => speakChunk(gen), 80);
}

export function pauseSpeaking() {
  if (state.status !== "speaking") return;
  generation += 1;
  cancelSynth(); // resumes from the start of the current sentence
  setState({ ...state, status: "paused" });
}

export function resumeSpeaking() {
  if (state.status !== "paused" || !isSpeechSupported()) return;
  const gen = ++generation;
  setState({ ...state, status: "speaking" });
  setTimeout(() => speakChunk(gen), 80);
}

export function stopSpeaking() {
  if (!isSpeechSupported()) return;
  generation += 1;
  cancelSynth();
  chunks = [];
  index = 0;
  if (state !== IDLE) setState(IDLE);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSpeakState(): SpeakState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}
