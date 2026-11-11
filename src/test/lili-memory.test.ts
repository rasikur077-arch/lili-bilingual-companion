import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearLiliMemories, deleteLiliMemory, getLiliMemories, saveLiliMemory } from "@/lib/lili-memory";

describe("Lili memory storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves, reads, and deletes a memory", () => {
    const saved = saveLiliMemory("  Prefer Bangla replies  ");
    expect(saved).toHaveLength(1);
    expect(saved[0]?.content).toBe("Prefer Bangla replies");
    expect(getLiliMemories()).toEqual(saved);
    expect(deleteLiliMemory(saved[0]!.id)).toEqual([]);
  });

  it("ignores empty and oversized memories", () => {
    expect(saveLiliMemory("   ")).toEqual([]);
    expect(saveLiliMemory("x".repeat(501))).toEqual([]);
  });

  it("does not throw when browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });

    expect(() => saveLiliMemory("A memory")).not.toThrow();
    expect(() => deleteLiliMemory("missing")).not.toThrow();
    expect(() => clearLiliMemories()).not.toThrow();
  });
});
