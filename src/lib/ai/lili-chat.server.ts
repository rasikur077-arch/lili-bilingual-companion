import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";

import { selectRelevantMemories } from "@/lib/ai/lili-context";
import { aiSettingsSchema, buildLiliInstructions } from "@/lib/lili-prompt";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server.ts";

const LEGACY_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const DEFAULT_MODEL = "openai/gpt-6-astra";
const MAX_HISTORY = 30;
const MAX_MESSAGE_CHARS = 12_000;
const MAX_TOTAL_CHARS = 60_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_MESSAGE = 3;
const IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_MEMORIES = 100;

const partSchema = z.object({ type: z.string() }).passthrough();
const bodySchema = z.object({
  id: z.string().max(100).optional(),
  messages: z
    .array(
      z
        .object({
          id: z.string().max(200),
          role: z.enum(["user", "assistant"]),
          parts: z.array(partSchema).max(50),
        })
        .passthrough(),
    )
    .min(1)
    .max(500),
  settings: aiSettingsSchema.partial().optional(),
  memories: z.array(z.string().max(500)).max(MAX_MEMORIES).optional(),
});

function validateImageParts(messages: UIMessage[]): string | null {
  for (const message of messages) {
    const imageParts = message.parts.filter((part) => part.type === "file");
    if (imageParts.length > MAX_IMAGES_PER_MESSAGE) {
      return "A message can contain up to 3 images. (এক বার্তায় সর্বোচ্চ ৩টি ছবি পাঠানো যাবে।)";
    }

    for (const part of imageParts) {
      if (!("mediaType" in part) || typeof part.mediaType !== "string" || !IMAGE_MEDIA_TYPES.has(part.mediaType)) {
        return "Only JPG, PNG, WebP, and GIF images are supported. (শুধু JPG, PNG, WebP ও GIF ছবি পাঠানো যাবে।)";
      }
      if (!("url" in part) || typeof part.url !== "string") {
        return "The attached image is invalid. Please attach it again. (ছবিটি ঠিকভাবে যুক্ত হয়নি। আবার দিন।)";
      }

      const prefix = `data:${part.mediaType};base64,`;
      if (!part.url.startsWith(prefix)) {
        return "Images must be uploaded directly from your device. (ডিভাইস থেকে সরাসরি ছবি নির্বাচন করুন।)";
      }
      const base64 = part.url.slice(prefix.length);
      const estimatedBytes = Math.floor((base64.length * 3) / 4);
      if (!base64 || estimatedBytes > MAX_IMAGE_BYTES || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
        return "Each image must be 5 MB or smaller. (প্রতিটি ছবি সর্বোচ্চ ৫ MB হতে পারবে।)";
      }
    }
  }
  return null;
}

function textError(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/** Turns a gateway/SDK failure into a safe, user-facing message (no internals leaked). */
export function friendlyAiError(error: unknown): string {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  switch (status) {
    case 402:
      return "This AI provider requires credits. No paid fallback is enabled. (এই AI ব্যবহারে ক্রেডিট লাগছে।)";
    case 403:
      return "Lili's configured AI provider denied access. Check its server settings. (AI ব্যবহারের অনুমতি নেই।)";
    case 429:
      return "The AI provider is busy or has reached its free limit. Please wait and try again. (একটু পরে আবার চেষ্টা করুন।)";
    case 400:
      return "Lili couldn't process that message. Try rephrasing or starting a new chat. (বার্তাটি প্রক্রিয়া করা যায়নি।)";
    case 401:
      return "Lili's AI connection isn't configured correctly. (AI সংযোগে সমস্যা।)";
    default:
      if (status && status >= 500)
        return "Lili's AI service is having trouble right now. Please try again in a moment. (সার্ভারে সমস্যা, একটু পরে চেষ্টা করুন।)";
      return "Something went wrong while Lili was replying. Please try again. (কিছু একটা সমস্যা হয়েছে।)";
  }
}

export async function handleLiliChat(request: Request): Promise<Response> {
  const configuredBaseURL = process.env["LILI_AI_BASE_URL"]?.trim();
  const useLegacyGateway = process.env["LILI_AI_USE_LEGACY_GATEWAY"] === "true";
  const baseURL = configuredBaseURL || (useLegacyGateway ? LEGACY_GATEWAY_URL : "");
  const isLovableGateway = baseURL.replace(/\/$/, "") === LEGACY_GATEWAY_URL;
  const isLocalEndpoint = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseURL);
  const modelName =
    process.env["LILI_AI_MODEL"]?.trim() || (isLocalEndpoint ? "qwen2.5:1.5b" : DEFAULT_MODEL);
  const apiKey =
    process.env["LILI_AI_API_KEY"]?.trim() ||
    (isLovableGateway ? process.env["LOVABLE_API_KEY"] : undefined);

  // Local OpenAI-compatible servers (for example, Ollama or LM Studio) can use
  // a placeholder key. Remote providers must supply their key on the server.
  if (!baseURL) {
    return textError("Lili is in zero-cost mode, but no local AI engine is connected yet.", 503);
  }
  if (!apiKey && !isLocalEndpoint) {
    console.error("[lili-chat] No API key configured for the selected AI provider");
    return textError("The selected remote AI provider needs a server-side key. No paid provider will be started automatically.", 503);
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return textError("Invalid chat request. Please refresh the page and try again.", 400);
  }

  const uiMessages = parsed.messages.slice(-MAX_HISTORY) as unknown as UIMessage[];
  const imageValidation = validateImageParts(uiMessages);
  if (imageValidation) return textError(imageValidation, 413);

    message.parts.reduce(
      (total, part) => total + (part.type === "text" && typeof part.text === "string" ? part.text.length : 0),
      0,
    ),
  );
  if (textLengths.some((length) => length > MAX_MESSAGE_CHARS) || textLengths.reduce((a, b) => a + b, 0) > MAX_TOTAL_CHARS) {
    return textError("This conversation is too long to process at once. Start a new chat or shorten the message.", 413);
  }

  const settings = aiSettingsSchema.parse(parsed.settings ?? {});
  const latestUserText = [...uiMessages]
    .reverse()
    .find((message) => message.role === "user")
    ?.parts.filter((part) => part.type === "text")
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join(" ") ?? "";
  const memories = selectRelevantMemories(parsed.memories ?? [], latestUserText);

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(
      uiMessages.map((message) => ({
        ...message,
        parts: message.parts.filter((part) => part.type === "text"),
      })),
    );
  } catch {
    return textError("Invalid chat history. Please start a new chat.", 400);
  }

  const runIdFetch = isLovableGateway
    ? createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request))
    : undefined;
  const provider = createOpenAI({
    baseURL,
    apiKey: apiKey || "local-development",
    ...(isLovableGateway
      ? {
          headers: { "Lovable-API-Key": apiKey!, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch!.fetch,
        }
      : {}),
  });

  const result = streamText({
    model: isLovableGateway ? provider.responses(modelName) : provider.chat(modelName),
    instructions: buildLiliInstructions(settings, memories),
    messages: modelMessages,
    abortSignal: request.signal,
    maxRetries: 0,
    maxOutputTokens: 1200,
    onError: ({ error }) => {
      console.error("[lili-chat] AI request failed:", error);
    },
    ...(isLovableGateway
      ? {
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
        }
      : {}),
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: uiMessages,
    sendReasoning: false,
    onError: friendlyAiError,
  });

  return runIdFetch ? withLovableAiGatewayRunIdHeader(response, runIdFetch) : response;
}
