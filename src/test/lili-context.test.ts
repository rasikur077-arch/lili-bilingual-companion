import { describe, expect, it } from "vitest";

import { selectRelevantMemories } from "@/lib/ai/lili-context";

describe("Lili memory context selection", () => {
  it("keeps a small context and prioritizes memories relevant to the latest message", () => {
    const memories = [
      "Likes cricket",
      "Studies biology",
      "Prefers Bangla replies",
      "Uses an Android phone",
      "Wants to study in Italy",
      "Enjoys strategy games",
      "Preparing for admission",
      "Likes concise explanations",
      "Has a hibiscus plant",
      "Uses a Samsung device",
    ];

    expect(selectRelevantMemories(memories, "Help me with biology admission study")).toEqual([
      "Studies biology",
      "Preparing for admission",
    ]);
  });

  it("uses the latest saved memories when the message has no useful keywords", () => {
    const memories = Array.from({ length: 10 }, (_, index) => `Memory ${index}`);
    expect(selectRelevantMemories(memories, "")).toEqual(memories.slice(-8));
  });

  it("returns a short fallback when nothing matches", () => {
    const memories = Array.from({ length: 10 }, (_, index) => `Fact ${index}`);
    expect(selectRelevantMemories(memories, "volcano geology")).toEqual(memories.slice(-4));
  });

  it("trims and ignores empty entries", () => {
    expect(selectRelevantMemories(["  Bangla  ", " ", "x".repeat(600)], "")).toEqual([
      "Bangla",
      "x".repeat(500),
    ]);
  });
});
