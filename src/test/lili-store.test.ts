import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  clearAllThreads,
  createThreadWithMessage,
  markThreadStarted,
  saveThreadMessages,
  toChatUIMessages,
} from "@/lib/lili-store";

function readThreads() {
  return JSON.parse(window.localStorage.getItem("lili.threads.v1") ?? "[]");
}

describe("Lili chat storage", () => {
  beforeEach(() => clearAllThreads());

  it("defaults Lili's reply language to Bangla", () => {
    expect(DEFAULT_SETTINGS.replyLanguage).toBe("bn");
  });

  it("starts a new chat with only the user's message and no pre-written reply", () => {
    const id = createThreadWithMessage("হ্যালো Lili");
    const [thread] = readThreads();
    expect(thread.id).toBe(id);
    expect(thread.pending).toBe(true);
    expect(thread.messages.map((m: { role: string }) => m.role)).toEqual(["user"]);
    markThreadStarted(id);
    expect(readThreads()[0].pending).toBe(false);
  });

  it("titles a new chat from its first message", () => {
    createThreadWithMessage("Help me write a polite email");
    expect(readThreads()[0].title).toBe("Help me write a polite email");
  });

  it("persists image metadata without storing image bytes in local storage", () => {
    const id = createThreadWithMessage("Look at this");
    const [thread] = readThreads();
    saveThreadMessages(id, [
      ...thread.messages,
      {
        id: "msg_image",
        role: "user",
        parts: [
          { type: "text", text: "What is this?" },
          { type: "file", mediaType: "image/jpeg", filename: "photo.jpg", url: "data:image/jpeg;base64,AAAA" },
        ],
      },
    ]);
    const saved = readThreads()[0].messages.find((m: { id: string }) => m.id === "msg_image");
    expect(saved.parts).toEqual([
      { type: "text", text: "What is this?" },
      { type: "file", mediaType: "image/jpeg", filename: "photo.jpg" },
    ]);
    expect(JSON.stringify(readThreads())).not.toContain("data:image/jpeg");
  });

  it("saves only text parts and never sends legacy notices to the AI", () => {
    const id = createThreadWithMessage("hi");
    const [thread] = readThreads();
    saveThreadMessages(id, [
      ...thread.messages,
      {
        id: "msg_a",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "thinking" },
          { type: "text", text: "হ্যালো!" },
        ],
      },
    ]);
    const saved = readThreads()[0].messages;
    expect(saved[1].parts).toEqual([{ type: "text", text: "হ্যালো!" }]);

    const ui = toChatUIMessages([
      ...saved,
      { id: "n1", role: "notice", parts: [{ type: "text", text: "old" }], createdAt: 1 },
    ]);
    expect(ui.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
});
