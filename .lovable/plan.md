# On-device (free) Lili brain — feasibility and plan

## Short answer
Feasible, but with limits. On the Samsung Galaxy M14 4G (SM-M145F: Snapdragon 680, Adreno 610 GPU, 4–6 GB RAM) a small model can genuinely reply, offline and free, but:
- Speed: roughly 3–8 words per second after loading; first load takes 1–3 minutes on Wi-Fi.
- Quality: simple Bangla chat is okay; long or nuanced Bangla, and Banglish, will be noticeably weaker than today's cloud replies. Facts can be wrong more often.
- The phone's GPU (Adreno 610) is old; Chrome's GPU acceleration (WebGPU) is likely unavailable or unreliable on it, so the plan must not depend on it.

## Recommended choice
- Engine: **wllama** (llama.cpp compiled to WebAssembly, free/open-source, runs on the phone's CPU, works without WebGPU). Optional later: WebLLM when WebGPU is present.
- Default model: **Gemma 3 1B Instruct, 4-bit (GGUF Q4_0)** — about **0.7 GB** one-time download, ~1.2 GB RAM while running. Best Bangla among models this small.
- Lightweight fallback: **Qwen2.5 0.5B Instruct, Q4_K_M** — about **0.4 GB**, faster, weaker Bangla. Offered automatically for phones with low memory.
- Models are downloaded from Hugging Face (free, no key) and cached in the browser, so later visits load from the phone.
- Rejected: Gemma 2 2B / Llama 3.2 3B (1.5–2 GB, too heavy for 4 GB phones); MediaPipe/WebLLM-only paths (need WebGPU).

## How it will behave for the user
1. Settings gets an "Lili's brain" choice: **On this phone (free)** or **Cloud** (current). The current cloud path stays untouched until you decide to remove it.
2. First time on-device is chosen: a card explains size (~0.7 GB), suggests Wi-Fi, and shows a real download progress bar with Cancel.
3. While replying: existing thinking animation, then words stream in; Stop button works; read-aloud works unchanged.
4. Unsupported/too-weak device (no WebAssembly, under ~3 GB memory reported, storage quota too small, load crash): clear bilingual message, offer the smaller model, or the cloud option. Never a fake reply.
5. Memory errors mid-reply: friendly error bubble with Retry (existing component).

## Implementation steps
1. Add `@wllama/wllama` dependency (only loaded in the browser, lazily, on the chat page).
2. New `src/lib/ai/on-device.ts`: device check (WebAssembly, `navigator.deviceMemory`, `storage.estimate()`), model picker, load-with-progress, and a single shared engine instance.
3. A custom chat "transport" so the existing `useChat` chat screen streams from the on-device engine instead of `/api/chat` — chat screen, bubbles, history and storage format stay the same.
4. Reuse the existing Lili personality instructions (shortened for small models, Bangla default kept), last ~8 messages only to fit memory.
5. Settings additions: engine choice, model choice, "Delete downloaded model" with size shown. Status pill shows "On-device" vs "Online".
6. Faster multi-threading needs special browser security headers; first version runs single-threaded (safe everywhere), headers added as a measured follow-up only if they don't break anything.

## Protecting the live app
- All work done in a separate draft copy; GitHub main branch and the published site are not touched until you approve.
- Cloud stays the default during testing; on-device is opt-in.
- Nothing is published, and no paid features are enabled.

## Testing
- Automated: device-check rules (low memory → small model, no WebAssembly → unsupported), prompt trimming, transport error mapping.
- Browser test on desktop Chromium: real download of the 0.4 GB model, real Bangla and English replies, Stop, reload persistence.
- On your phone (I can't test the real device): open the draft preview, choose "On this phone", record load time, reply speed and Bangla quality for 5 sample prompts (Bangla, English, Banglish). Decide afterwards whether to make on-device the default.

## Open questions (assumptions used)
- Keep the cloud option available as a choice? Assumed yes.
- Is a ~0.7 GB one-time download acceptable? Assumed yes, with the 0.4 GB option as backup.
