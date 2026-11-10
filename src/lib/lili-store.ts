import { useSyncExternalStore } from "react";

/**
 * Browser-only storage for the LILI AI prototype (chat threads + settings).
 * Messages follow the AI SDK UIMessage shape ({ id, role, parts }) so a real
 * model can be wired in later without migrating saved data.
 */

export type TextPart = { type: "text"; text: string };
export type ChatRole = "user" | "assistant" | "notice";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  parts: TextPart[];
  createdAt: number;
};

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

export type Tone = "friendly" | "professional" | "playful";
export type ReplyLanguage = "bn" | "en" | "mix";
export type ReplyLength = "short" | "balanced" | "detailed";
export type VoiceLang = "bn-BD" | "en-US";

export type Settings = {
  userName: string;
  tone: Tone;
  replyLanguage: ReplyLanguage;
  replyLength: ReplyLength;
  voiceLang: VoiceLang;
  sendOnEnter: boolean;
  showTimestamps: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  userName: "",
  tone: "friendly",
  replyLanguage: "mix",
  replyLength: "balanced",
  voiceLang: "bn-BD",
  sendOnEnter: true,
  showTimestamps: true,
};

function createLocalStore<T>(key: string, initial: T, normalize: (raw: unknown) => T) {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cache !== null) return cache;
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? normalize(JSON.parse(raw)) : initial;
    } catch {
      cache = initial;
    }
    return cache;
  };

  const emit = () => listeners.forEach((l) => l());

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        cache = null;
        emit();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const set = (updater: (prev: T) => T) => {
    cache = updater(read());
    try {
      window.localStorage.setItem(key, JSON.stringify(cache));
    } catch {
      // Storage full or blocked: keep in-memory state.
    }
    emit();
  };

  const useValue = () => useSyncExternalStore(subscribe, read, () => initial);

  return { read, set, useValue };
}

const EMPTY_THREADS: Thread[] = [];

const threadStore = createLocalStore<Thread[]>("lili.threads.v1", EMPTY_THREADS, (raw) =>
  Array.isArray(raw) ? (raw as Thread[]) : EMPTY_THREADS,
);

const settingsStore = createLocalStore<Settings>("lili.settings.v1", DEFAULT_SETTINGS, (raw) => ({
  ...DEFAULT_SETTINGS,
  ...(raw && typeof raw === "object" ? (raw as Partial<Settings>) : {}),
}));

export const useThreads = threadStore.useValue;
export const useSettings = settingsStore.useValue;

export function updateSettings(patch: Partial<Settings>) {
  settingsStore.set((prev) => ({ ...prev, ...patch }));
}

export function newId(prefix = "id") {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

export function textMessage(role: ChatRole, text: string): ChatMessage {
  return { id: newId("msg"), role, parts: [{ type: "text", text }], createdAt: Date.now() };
}

export function messageText(m: ChatMessage) {
  return m.parts.map((p) => p.text).join("");
}

/** Shown in place of a reply while no AI model is connected. Never a fake answer. */
export const NOT_CONNECTED_NOTICE =
  "AI এখনো সংযুক্ত হয়নি · Lili can't reply yet — no AI model is connected. Your message is saved.";

function makeTitle(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean || "New chat";
}

/** Creates a thread with the first user message and returns its id. */
export function createThreadWithMessage(text: string): string {
  const now = Date.now();
  const thread: Thread = {
    id: newId("t"),
    title: makeTitle(text),
    createdAt: now,
    updatedAt: now,
    messages: [textMessage("user", text), textMessage("notice", NOT_CONNECTED_NOTICE)],
  };
  threadStore.set((prev) => [thread, ...prev]);
  return thread.id;
}

export function sendToThread(threadId: string, text: string) {
  threadStore.set((prev) =>
    prev.map((t) =>
      t.id === threadId
        ? {
            ...t,
            updatedAt: Date.now(),
            messages: [
              ...t.messages,
              textMessage("user", text),
              textMessage("notice", NOT_CONNECTED_NOTICE),
            ],
          }
        : t,
    ),
  );
}

export function deleteThread(threadId: string) {
  threadStore.set((prev) => prev.filter((t) => t.id !== threadId));
}

export function clearAllThreads() {
  threadStore.set(() => []);
}
