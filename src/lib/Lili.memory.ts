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
    const parsed = data ? JSON.parse(data) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLiliMemory(content: string): LiliMemory[] {
  const clean = content.trim();

  if (!clean || clean.length > 500) {
    return getLiliMemories();
  }

  const memories = getLiliMemories();

  const newMemory: LiliMemory = {
    id: crypto.randomUUID(),
    content: clean,
    createdAt: Date.now(),
  };

  const updated = [...memories, newMemory].slice(-100);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    return memories;
  }

  return updated;
}

export function deleteLiliMemory(id: string): LiliMemory[] {
  const updated = getLiliMemories().filter(
    (memory) => memory.id !== id
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearLiliMemories(): void {
  localStorage.removeItem(STORAGE_KEY);
    }
