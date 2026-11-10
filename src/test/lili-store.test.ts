import { beforeEach, describe, expect, it } from "vitest";

import {
  NOT_CONNECTED_NOTICE,
  clearAllThreads,
  createThreadWithMessage,
  messageText,
  sendToThread,
} from "@/lib/lili-store";

function readThreads() {
  return JSON.parse(window.localStorage.getItem("lili.threads.v1") ?? "[]");
}

describe("Lili prototype chat (no AI connected)", () => {
  beforeEach(() => clearAllThreads());

  it("never invents an assistant reply — it adds a not-connected notice instead", () => {
    const id = createThreadWithMessage("হ্যালো Lili");
    sendToThread(id, "Second message");
    const [thread] = readThreads();
    const roles = thread.messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(["user", "notice", "user", "notice"]);
    expect(roles).not.toContain("assistant");
    expect(messageText(thread.messages[1])).toBe(NOT_CONNECTED_NOTICE);
  });

  it("titles a new chat from its first message", () => {
    createThreadWithMessage("Help me write a polite email");
    expect(readThreads()[0].title).toBe("Help me write a polite email");
  });
});
