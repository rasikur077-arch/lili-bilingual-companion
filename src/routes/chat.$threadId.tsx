import { useEffect, useRef } from "react";
import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { ChevronLeft, MessageSquarePlus } from "lucide-react";

import { AiStatusPill, PageHeader } from "@/components/lili/AppShell";
import { Composer } from "@/components/lili/Composer";
import { LiliAvatar } from "@/components/lili/LiliAvatar";
import { MessageBubble } from "@/components/lili/MessageBubble";
import { Button } from "@/components/ui/button";
import { sendToThread, useSettings, useThreads } from "@/lib/lili-store";

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
  const settings = useSettings();
  const thread = threads.find((t) => t.id === threadId);
  const endRef = useRef<HTMLDivElement>(null);

  const count = thread?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count, threadId]);

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

      <main
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scrollbar-none px-4 py-4"
        aria-live="polite"
      >
        {thread.messages.map((m) => (
          <MessageBubble key={m.id} message={m} showTime={settings.showTimestamps} />
        ))}
        <div ref={endRef} />
      </main>

      <div className="px-3 pb-3">
        <Composer key={threadId} onSend={(text) => sendToThread(threadId, text)} />
      </div>
    </>
  );
}
