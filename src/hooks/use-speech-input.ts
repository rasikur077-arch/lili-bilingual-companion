import { useCallback, useEffect, useRef, useState } from "react";

// Minimal Web Speech API typings (not part of TypeScript's DOM lib).
type SpeechResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onstart: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Options = {
  lang: string;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
};

/** Browser speech-to-text (runs on-device / in the browser, no API key). */
export function useSpeechInput({ lang, onTranscript, onError }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const cbRef = useRef({ onTranscript, onError });
  cbRef.current = { onTranscript, onError };

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      cbRef.current.onError?.("Voice input isn't supported in this browser. Try Chrome on Android.");
      return;
    }
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      // The browser includes prior final results plus the latest interim result.
      // Rebuild the complete transcript on every event to avoid duplicated words.
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += `${e.results[i]?.[0]?.transcript ?? ""} `;
      }
      cbRef.current.onTranscript(text.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      const messages: Record<string, string> = {
        "not-allowed": "Microphone permission was blocked. Allow it in your browser settings. (মাইক্রোফোন ব্যবহারের অনুমতি দিন।)",
        "no-speech": "No speech detected. Please try speaking a little closer to the microphone. (কোনো কথা শোনা যায়নি, আবার চেষ্টা করুন।)",
        "audio-capture": "No microphone was found. Check your device microphone. (মাইক্রোফোন পাওয়া যায়নি।)",
        network: "Voice recognition needs an internet connection in this browser. (ভয়েস চিনতে ইন্টারনেট সংযোগ লাগতে পারে।)",
      };
      cbRef.current.onError?.(messages[e.error] ?? `Voice input error: ${e.error}`);
    };
    rec.onend = () => {
      // An older recognition instance may finish after a new one has started.
      // Only let the active instance update the shared listening state.
      if (recRef.current !== rec) return;
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
      cbRef.current.onError?.("Could not start the microphone. Please try again. (মাইক্রোফোন চালু করা যায়নি।)");
    }
  }, [lang]);

  return { supported, listening, start, stop };
}
