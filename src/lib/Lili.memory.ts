export type LiliMemory = {
  id: string;
  content: string;
  createdAt: number;
};

const STORAGE_KEY = "lili.memories.v1";

export function getLiliMemories(): LiliMemory[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? (parsed as LiliMemory[]) : [];
  } catch {
    return [];
  }
}

export function saveLiliMemory(content: string): LiliMemory[] {
  const clean = content.trim();
  if (!clean || clean.length > 500) return getLiliMemories();

  const memories = getLiliMemories();
  const newMemory: LiliMemory = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `memory_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    content: clean,
    createdAt: Date.now(),
  };
  const updated = [...memories, newMemory].slice(-100);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return memories;
  }
}

export function deleteLiliMemory(id: string): LiliMemory[] {
  const updated = getLiliMemories().filter((memory) => memory.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return getLiliMemories();
  }
}

export function clearLiliMemories(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable or blocked by the browser.
  }
}
