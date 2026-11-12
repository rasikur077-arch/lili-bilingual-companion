import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import { DefaultChatTransport } from "ai";
import { ChevronLeft, MessageSquarePlus } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { AiStatusPill, PageHeader } from "@/components/lili/AppShell";
import { Composer } from "@/components/lili/Composer";
import { LiliAvatar } from "@/components/lili/LiliAvatar";
import { ErrorBubble, MessageBubble, ThinkingBubble } from "@/components/lili/MessageBubble";
import { Button } from "@/components/ui/button";
import {
  markThreadStarted,
  saveThreadMessages,
  toChatUIMessages,
  useSettings,
  useThreads,
  type Thread,
  newId,
} from "@/lib/lili-store";
import { getChatImages, imageBlobToDataUrl, saveChatImage } from "@/lib/lili-attachments";
import { getLiliMemories } from "@/lib/lili-memory";
import { speakReply, stopSpeaking, warmUpVoices } from "@/lib/lili-tts";

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversation — LILI AI" },
      { name: "description", content: "Your conversation with Lili, your personal AI assistant." },
      { property: "og:title", content: "Conversation — LILI AI" },
      {
        property: "og:description",
        content: "Your conversation with Lili, your personal AI assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const hydrated = useHydrated();
  const threads = useThreads();
  const thread = threads.find((t) => t.id === threadId);

  if (!hydrated) return <div className="flex-1" />;

  if (!thread) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <LiliAvatar size="md" />
        <h1 className="text-lg font-semibold">Conversation not found</h1>
        <p className="text-sm text-muted-foreground">
          It may have been deleted, or it was saved on another device.
        </p>
        <Button variant="glow" className="rounded-full" asChild>
          <Link to="/">Start a new chat</Link>
        </Button>
      </div>
    );
  }

  return <ChatWindow key={thread.id} thread={thread} />;
}

function partsText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

function ChatWindow({ thread }: { thread: Thread }) {
  const [initialMessages, setInitialMessages] = useState<ReturnType<typeof toChatUIMessages> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function restoreImages() {
      const restored = await Promise.all(
        toChatUIMessages(thread.messages).map(async (message) => {
          const images = await getChatImages(thread.id, message.id).catch(() => []);
          const fileParts = await Promise.all(images.map(async (image) => ({
            type: "file" as const,
            mediaType: image.mediaType,
            filename: image.filename,
            url: await imageBlobToDataUrl(image.blob),
          })));
          return { ...message, parts: [...message.parts, ...fileParts] };
        }),
      );
      if (!cancelled) setInitialMessages(restored as ReturnType<typeof toChatUIMessages>);
    }
    void restoreImages().catch(() => {
      if (!cancelled) setInitialMessages(toChatUIMessages(thread.messages));
    });
    return () => { cancelled = true; };
  }, [thread.id, thread.messages]);

  if (!initialMessages) return <div className="flex-1" role="status" aria-label="Restoring conversation" />;
  return <ChatRuntime thread={thread} initialMessages={initialMessages} />;
}

function ChatRuntime({ thread, initialMessages }: {
  thread: Thread;
  initialMessages: ReturnType<typeof toChatUIMessages>;
}) {
  const settings = useSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => {
          const s = settingsRef.current;
          return {
            settings: {
              userName: s.userName,
              tone: s.tone,
              replyLanguage: s.replyLanguage,
              replyLength: s.replyLength,
            },
            memories: getLiliMemories().map((m) => m.content),
          };
        },
      }),
  );

  const { messages, sendMessage, regenerate, status, error, stop, clearError } = useChat({
    id: thread.id,
    messages: initialMessages,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const wasBusy = useRef(false);

  // Optional hands-free replies: speak only after a new assistant turn finishes.
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    const latest = messages.at(-1);
    if (!settings.autoReadReplies || latest?.role !== "assistant") return;
    const reply = partsText(latest.parts).trim();
    if (reply) void speakReply(latest.id, reply, (message) => toast(message));
  }, [busy, messages, settings.autoReadReplies]);

  // Read-aloud: load voices early; stop speaking when leaving this conversation.
  useEffect(() => {
    warmUpVoices();
    return () => stopSpeaking();
  }, []);

  // Persist to this thread whenever a turn settles (and right after the user sends).
  useEffect(() => {
    if (status === "streaming") return;
    saveThreadMessages(thread.id, messages);
  }, [messages, status, thread.id]);

  // A thread created from the home screen sends its first message exactly once.
  const kicked = useRef(false);
  // Deferred so a dev-mode remount can't cancel the request mid-flight.
  useEffect(() => {
    if (kicked.current || !thread.pending) return;
    const timer = setTimeout(() => {
      if (kicked.current) return;
      kicked.current = true;
      markThreadStarted(thread.id);
      void regenerate();
    }, 0);
    return () => clearTimeout(timer);
  }, [thread.id, thread.pending, regenerate]);

  const createdAt = new Map(thread.messages.map((m) => [m.id, m.createdAt]));
  const last = messages.at(-1);
  const lastAssistantEmpty =
    last?.role === "assistant" && partsText(last.parts).trim().length === 0;
  const thinking = status === "submitted" || (status === "streaming" && lastAssistantEmpty);
  const unanswered = !busy && !error && last?.role === "user" && !thread.pending;

  const retry = () => {
    clearError();
    void regenerate();
  };

  return (
    <>
      <PageHeader
        left={
          <Button variant="glass" size="icon" className="rounded-full" asChild>
            <Link to="/history" aria-label="Back to history">
              <ChevronLeft />
            </Link>
          </Button>
        }
        title={
          <span className="flex items-center gap-2">
            <LiliAvatar size="sm" />
            <span className="truncate">{thread.title}</span>
          </span>
        }
        right={
          <Button variant="glass" size="icon" className="rounded-full" asChild>
            <Link to="/" aria-label="New chat">
              <MessageSquarePlus />
            </Link>
          </Button>
        }
      />
      <div className="flex justify-center pb-2">
        <AiStatusPill />
      </div>

      <Conversation className="min-h-0">
        <ConversationContent className="gap-4 px-4 py-4">
          {messages.map((m, i) => {
            if (m.role !== "user" && m.role !== "assistant") return null;
            const text = partsText(m.parts);
            const isStreamingThis = status === "streaming" && i === messages.length - 1;
            const images = m.parts
              .filter((part) => part.type === "file" && "url" in part && typeof part.url === "string")
              .map((part) => ({
                url: part.url as string,
                filename: "filename" in part && typeof part.filename === "string" ? part.filename : "Attached image",
              }));
            if (m.role === "assistant" && !text.trim()) return null;
            if (m.role === "user" && !text.trim() && images.length === 0) return null;
            return (
              <MessageBubble
                key={m.id}
                id={m.role === "assistant" ? m.id : undefined}
                role={m.role}
                text={text}
                images={images}
                streaming={isStreamingThis}
                time={settings.showTimestamps ? (createdAt.get(m.id) ?? Date.now()) : undefined}
              />
            );
          })}
          {thinking && <ThinkingBubble language={settings.replyLanguage} />}
          {error && <ErrorBubble message={readableError(error)} onRetry={retry} />}
          {unanswered && (
            <ErrorBubble
              message="Lili hasn't replied to this message yet. (এই বার্তার উত্তর এখনো আসেনি।)"
              onRetry={retry}
            />
          )}
        </ConversationContent>
        <ConversationScrollButton className="glass bottom-2 text-foreground" />
      </Conversation>

      <div className="px-3 pb-3">
        <Composer
          busy={busy}
          onStop={() => void stop()}
          onSend={(text, files) => {
            clearError();
            const messageId = newId("msg");
            void (async () => {
              try {
                await Promise.all(files.map((file, index) => saveChatImage({
                  threadId: thread.id,
                  messageId,
                  index,
                  blob: file,
                  mediaType: file.type,
                  filename: file.name,
                })));
              } catch {
                toast.error("ছবিটি এই ডিভাইসে সংরক্ষণ করা যায়নি; chat বন্ধ করলে এটি হারিয়ে যেতে পারে।");
              }
              await sendMessage({ text, files, messageId });
            })();
          }}
        />
      </div>
    </>
  );
}

function readableError(error: Error) {
  const msg = error.message?.trim();
  if (!msg || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Couldn't reach Lili. Check your internet connection and try again. (ইন্টারনেট সংযোগ পরীক্ষা করুন।)";
  }
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
}
