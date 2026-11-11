import { Wllama } from "@wllama/wllama";
import WasmFromCDN from "@wllama/wllama/esm/wasm-from-cdn.js";

const MODEL_URL =
  "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf";

type Progress = { loaded: number; total: number };
type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

let engine: Wllama | null = null;
let loading: Promise<Wllama> | null = null;

/**
 * Load the small multilingual model locally in the browser.
 * Model bytes are cached by Wllama after the first successful download.
 * No model/API key is sent to Lili's server.
 */
export async function loadOnDeviceModel(
  onProgress?: (progress: Progress) => void,
): Promise<void> {
  if (engine) return;
  if (loading) {
    await loading;
    return;
  }

  loading = (async () => {
    const instance = new Wllama(WasmFromCDN);
    await instance.loadModelFromUrl(MODEL_URL, {
      n_ctx: 2048,
      n_threads: 2,
      progressCallback: onProgress,
      useCache: true,
    });
    engine = instance;
    return instance;
  })();

  try {
    await loading;
  } finally {
    loading = null;
  }
}

/** Generate a local reply. The caller owns UI state and cancellation handling. */
export async function generateOnDeviceReply(
  messages: ChatTurn[],
  onToken?: (token: string) => void,
): Promise<string> {
  if (!engine) {
    throw new Error("Lili's on-device model is not loaded yet.");
  }

  const stream = await engine.createChatCompletion({
    messages,
    max_tokens: 384,
    temperature: 0.7,
    top_p: 0.9,
    stream: true,
  });

  let reply = "";
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? "";
    if (token) {
      reply += token;
      onToken?.(token);
    }
  }
  return reply.trim();
}

export function isOnDeviceModelLoaded(): boolean {
  return engine !== null;
}
