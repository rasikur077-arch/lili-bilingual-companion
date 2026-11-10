import { useMemo, useState } from "react";
import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { MessageSquarePlus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/lili/AppShell";
import { LiliAvatar } from "@/components/lili/LiliAvatar";
import { Button } from "@/components/ui/button";
import { deleteThread, messageText, useThreads } from "@/lib/lili-store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Chat history — LILI AI" },
      { name: "description", content: "Browse and search your past conversations with Lili." },
      { property: "og:title", content: "Chat history — LILI AI" },
      {
        property: "og:description",
        content: "Browse and search your past conversations with Lili.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const hydrated = useHydrated();
  const threads = useThreads();
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...threads]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          t.messages.some((m) => messageText(m).toLowerCase().includes(q)),
      );
  }, [threads, query]);

  return (
    <>
      <PageHeader
        title="Chat history"
        subtitle="ইতিহাস · saved on this device"
        right={
          <Button variant="glow" size="icon" className="rounded-full" asChild>
            <Link to="/" aria-label="New chat">
              <MessageSquarePlus />
            </Link>
          </Button>
        }
      />

      <div className="px-4 pb-3">
        <label className="glass flex h-11 items-center gap-2 rounded-full px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </label>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-4 pb-4">
        {!hydrated ? null : list.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center animate-fade-up">
            <LiliAvatar size="md" />
            <p className="font-semibold">{query ? "No matching chats" : "No conversations yet"}</p>
            <p className="max-w-60 text-sm text-muted-foreground">
              {query ? "Try a different word." : "Say hello to Lili and your chats will appear here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {list.map((t, i) => {
              const last = [...t.messages].reverse().find((m) => m.role === "user");
              return (
                <li
                  key={t.id}
                  className="glass flex items-center gap-2 rounded-2xl pr-2 animate-message-in"
                  style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}
                >
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: t.id }}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3.5"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-sm font-bold text-primary-foreground">
                      {t.title.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {t.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {last ? messageText(last) : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(t.updatedAt, { addSuffix: false })}
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${t.title}`}
                    onClick={() => {
                      deleteThread(t.id);
                      toast.success("Chat deleted");
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
