import { describe, expect, it } from "vitest";

import { cleanForSpeech, filterSpeakableChunks, pickVoice, splitSpeechChunks } from "@/lib/lili-tts";

const v = (lang: string, name = lang) => ({ lang, name });

describe("Lili read-aloud", () => {
  it("prefers a Bengali (Bangladesh) voice over Bengali (India)", () => {
    const voices = [v("en-US"), v("bn-IN"), v("bn-BD")];
    expect(pickVoice(voices, "bn")?.lang).toBe("bn-BD");
  });

  it("recognises Android-style bn_BD voice tags", () => {
    expect(pickVoice([v("bn_IN"), v("bn_BD")], "bn")?.lang).toBe("bn_BD");
  });

  it("falls back to Bengali (India) when no Bangladesh voice is installed", () => {
    expect(pickVoice([v("en-US"), v("bn-IN")], "bn")?.lang).toBe("bn-IN");
  });

  it("reports no Bangla voice instead of using an English one", () => {
    expect(pickVoice([v("en-US"), v("en-GB")], "bn")).toBeNull();
  });

  it("skips Bangla chunks when no Bengali voice is installed but keeps English", () => {
    const planned = [
      { text: "বাংলা", lang: "bn" as const, voice: null },
      { text: "Hello", lang: "en" as const, voice: v("en-US") },
      { text: "বাংলা voice", lang: "bn" as const, voice: v("bn-BD") },
    ];
    expect(filterSpeakableChunks(planned).map((chunk) => chunk.text)).toEqual(["Hello", "বাংলা voice"]);
  });

  it("picks an English voice for English text", () => {
    expect(pickVoice([v("bn-BD"), v("en-GB")], "en")?.lang).toBe("en-GB");
  });

  it("reads Bangla sentences with the Bangla voice and English ones with English", () => {
    const chunks = splitSpeechChunks("আমি লিলি। কেমন আছেন?\n\nHello there, how are you?");
    expect(chunks.map((c) => c.lang)).toEqual(["bn", "en"]);
    expect(chunks[0]?.text).toBe("আমি লিলি। কেমন আছেন?");
  });

  it("keeps every word of a long reply, in short pieces", () => {
    const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const chunks = splitSpeechChunks(long);
    expect(chunks.every((c) => c.text.length <= 180)).toBe(true);
    expect(chunks.map((c) => c.text).join(" ")).toBe(long);
  });

  it("does not read Markdown symbols aloud", () => {
    expect(cleanForSpeech("## Title\n- **bold** item\n[link](https://x.y)")).toBe(
      "Title\nbold item\nlink",
    );
  });
});
