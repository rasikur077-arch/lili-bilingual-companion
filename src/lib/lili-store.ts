import { useSyncExternalStore } from "react";
import { deleteChatImages } from "@/lib/lili-attachments";

/**
 * Browser-only storage for LILI AI (chat threads + settings).
 * Messages follow the AI SDK UIMessage shape ({ id, role, parts }); the
 * `notice` role is a legacy prototype value that is never sent to the AI.
 */

export type TextPart = { type: "text"; text: string };
export type ImagePart = { type: "file"; mediaType: string; filename?: string };
export type ChatRole = "user" | "assistant" | "notice";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  parts: Array<TextPart | ImagePart>;
  createdAt: number;
};

export type Thread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  /** True until the chat page has sent the first message to Lili. */
  pending?: boolean;
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
  autoReadReplies: boolean;
  sendOnEnter: boolean;
  showTimestamps: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  userName: "",
  tone: "friendly",
  replyLanguage: "bn",
  replyLength: "balanced",
  voiceLang: "bn-BD",
  autoReadReplies: false,
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
  return m.parts.filter((p): p is TextPart => p.type === "text").map((p) => p.text).join("");
}

function makeTitle(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}…` : clean || "New chat";
}

/**
 * Creates a thread holding the first user message, flagged `pending` so the
 * chat page sends it to Lili exactly once. Returns the thread id.
 */
export function createThreadWithMessage(text: string): string {
  const now = Date.now();
  const thread: Thread = {
    id: newId("t"),
    title: makeTitle(text),
    createdAt: now,
    updatedAt: now,
    pending: true,
    messages: [textMessage("user", text)],
  };
  threadStore.set((prev) => [thread, ...prev]);
  return thread.id;
}

/** Clears the `pending` flag once the first request has been started. */
export function markThreadStarted(threadId: string) {
  threadStore.set((prev) => prev.map((t) => (t.id === threadId ? { ...t, pending: false } : t)));
}

type UIMessageLike = { id: string; role: string; parts: Array<{ type: string; text?: string; mediaType?: string; filename?: string }> };

/** Messages for the AI chat: legacy notices dropped, roles limited to user/assistant. */
export function toChatUIMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", parts: m.parts }));
}

/** Persists the chat's messages (text parts only). No-op when nothing changed. */
export function saveThreadMessages(threadId: string, messages: UIMessageLike[]) {
  const thread = threadStore.read().find((t) => t.id === threadId);
  if (!thread) return;
  const createdById = new Map(thread.messages.map((m) => [m.id, m.createdAt]));
  const next: ChatMessage[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id,
      role: m.role as ChatRole,
      parts: m.parts.flatMap((p) => {
        if (p.type === "text" && typeof p.text === "string") return [{ type: "text" as const, text: p.text }];
        if (p.type === "file" && typeof p.mediaType === "string" && p.mediaType.startsWith("image/")) {
          return [{ type: "file" as const, mediaType: p.mediaType, ...(typeof p.filename === "string" ? { filename: p.filename } : {}) }];
        }
        return [];
      }),
      createdAt: createdById.get(m.id) ?? Date.now(),
    }))
    .filter((m) => m.parts.length > 0 && (messageText(m).length > 0 || m.parts.some((p) => p.type === "file")));

  const sig = (list: ChatMessage[]) => JSON.stringify(list.map((m) => [m.id, m.role, m.parts]));
  if (sig(next) === sig(thread.messages)) return;

  threadStore.set((prev) =>
    prev.map((t) => (t.id === threadId ? { ...t, messages: next, updatedAt: Date.now() } : t)),
  );
}

export function deleteThread(threadId: string) {
  threadStore.set((prev) => prev.filter((t) => t.id !== threadId));
  void deleteChatImages(threadId).catch(() => {
    // A thread can still be deleted when IndexedDB is unavailable.
  });
}

export function clearAllThreads() {
  const threadIds = threadStore.read().map((thread) => thread.id);
  threadStore.set(() => []);
  for (const threadId of threadIds) {
    void deleteChatImages(threadId).catch(() => {
      // Clearing text history must not depend on browser image storage.
    });
  }
}
