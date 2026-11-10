import { describe, expect, it } from "vitest";

import { aiSettingsSchema, buildLiliInstructions } from "@/lib/lili-prompt";

describe("Lili instructions", () => {
  it("replies in Bangla by default when no language is chosen", () => {
    const settings = aiSettingsSchema.parse({});
    expect(settings.replyLanguage).toBe("bn");
    expect(buildLiliInstructions(settings)).toContain("Reply in natural, conversational Bangla");
  });

  it("uses English when the user picks English", () => {
    const text = buildLiliInstructions(aiSettingsSchema.parse({ replyLanguage: "en" }));
    expect(text).toContain("Reply in clear, natural English");
  });

  it("rejects unknown settings values sent from the browser", () => {
    expect(() => aiSettingsSchema.parse({ tone: "rude" })).toThrow();
  });
});
