import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";

import { aiSettingsSchema, buildLiliInstructions } from "@/lib/lili-prompt";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const MAX_HISTORY = 40;

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
});

function textError(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/** Turns a gateway/SDK failure into a safe, user-facing message (no internals leaked). */
export function friendlyAiError(error: unknown): string {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  switch (status) {
    case 402:
      return "AI credits have run out. The workspace owner can add credits in Settings → Plans & credits. (AI ক্রেডিট শেষ হয়ে গেছে।)";
    case 403:
      return "Lili's AI access is currently blocked for this workspace. Please ask the workspace admin to check AI settings. (AI ব্যবহারের অনুমতি নেই।)";
    case 429:
      return "Lili is getting too many requests right now. Please wait a moment and try again. (একটু পরে আবার চেষ্টা করুন।)";
    case 400:
      return "Lili couldn't process that message. Try rephrasing or starting a new chat. (বার্তাটি প্রক্রিয়া করা যায়নি।)";
    case 401:
      return "Lili's AI connection isn't configured correctly. Please contact the app owner. (AI সংযোগে সমস্যা।)";
    default:
      if (status && status >= 500)
        return "Lili's AI service is having trouble right now. Please try again in a moment. (সার্ভারে সমস্যা, একটু পরে চেষ্টা করুন।)";
      return "Something went wrong while Lili was replying. Please try again. (কিছু একটা সমস্যা হয়েছে।)";
  }
}

export async function handleLiliChat(request: Request): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    console.error("[lili-chat] LOVABLE_API_KEY is not configured");
    return textError("Lili's AI connection isn't configured yet. Please contact the app owner.", 500);
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return textError("Invalid chat request. Please refresh the page and try again.", 400);
  }

  const settings = aiSettingsSchema.parse(parsed.settings ?? {});
  const uiMessages = parsed.messages.slice(-MAX_HISTORY) as unknown as UIMessage[];

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(
      uiMessages.map((m) => ({ ...m, parts: m.parts.filter((p) => p.type === "text") })),
    );
  } catch {
    return textError("Invalid chat history. Please start a new chat.", 400);
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: buildLiliInstructions(settings),
    messages: modelMessages,
    abortSignal: request.signal,
    maxRetries: 0,
    onError: ({ error }) => {
      console.error("[lili-chat] AI request failed:", error);
    },
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: uiMessages,
      sendReasoning: true,
      onError: friendlyAiError,
    }),
    runIdFetch,
  );
}
