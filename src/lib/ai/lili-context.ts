const MAX_CONTEXT_MEMORIES = 8;
const MAX_MEMORY_LENGTH = 500;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "help",
  "in",
  "me",
  "my",
  "on",
  "please",
  "study",
  "studies",
  "the",
  "to",
  "with",
]);

function words(value: string) {
  return new Set(
    (value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
      (word) => word.length > 1 && !STOP_WORDS.has(word),
    ),
  );
}

/**
 * Keep the memory context small and prefer facts that overlap with the current
 * user message. Memories are still treated as untrusted data by the system prompt.
 */
export function selectRelevantMemories(memories: string[], latestUserText: string) {
  const cleaned = memories
    .filter((memory): memory is string => typeof memory === "string")
    .map((memory) => memory.trim().slice(0, MAX_MEMORY_LENGTH))
    .filter(Boolean);

  if (cleaned.length <= MAX_CONTEXT_MEMORIES) return cleaned;

  const queryWords = words(latestUserText);
  if (queryWords.size === 0) return cleaned.slice(-MAX_CONTEXT_MEMORIES);

  const ranked = cleaned.map((memory, index) => {
    const memoryWords = words(memory);
    let score = 0;
    for (const word of queryWords) {
      if (memoryWords.has(word)) score += word.length > 5 ? 2 : 1;
    }
    return { memory, index, score };
  });

  const relevant = ranked
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, MAX_CONTEXT_MEMORIES)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.memory);

  return relevant.length > 0 ? relevant : cleaned.slice(-4);
}
