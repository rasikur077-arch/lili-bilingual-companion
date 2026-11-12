import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { History, Brain } from "lucide-react";

import { AiStatusPill } from "@/components/lili/AppShell";
import { Composer } from "@/components/lili/Composer";
import { LiliAvatar } from "@/components/lili/LiliAvatar";
import { Button } from "@/components/ui/button";
import { createThreadWithMessage, useSettings } from "@/lib/lili-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LILI AI — Chat with Lili" },
      {
        name: "description",
        content: "Start a conversation with Lili, your friendly Bangla and English AI assistant.",
      },
      { property: "og:title", content: "LILI AI — Chat with Lili" },
      {
        property: "og:description",
        content: "Start a conversation with Lili, your friendly Bangla and English AI assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const suggestions = [
  "আজকের দিনটা কীভাবে প্ল্যান করব?",
  "Help me write a polite email",
  "একটা সহজ রেসিপি বলো",
  "Explain AI in simple words",
];

function Home() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [listening, setListening] = useState(false);

  const start = (text: string) => {
    const id = createThreadWithMessage(text);
    navigate({ to: "/chat/$threadId", params: { threadId: id } });
  };

  const name = settings.userName.trim();

  return (
    <>
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold tracking-[0.2em] text-gradient">
            LILI AI
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AiStatusPill />
          <Button variant="glass" size="icon" className="rounded-full" asChild>
            <Link to="/memory" aria-label="Lili's Memory">
              <Brain className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="glass" size="icon" className="rounded-full" asChild>
            <Link to="/history" aria-label="Chat history">
              <History />
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none px-4">
        <section className="flex flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
          <LiliAvatar size="lg" active={listening} className="h-72 w-full animate-fade-up" />
          <div className="animate-fade-up space-y-2" style={{ animationDelay: "0.15s" }}>
            <p className="text-sm font-medium text-cyan">
              {name ? `হ্যালো, ${name}!` : "হ্যালো! Hello!"}
            </p>
            <h1 className="text-[1.65rem] font-semibold leading-tight text-foreground">
              I'm <span className="text-gradient">Lili</span>, how can I
              <br /> help you today?
            </h1>
            <p className="text-sm text-muted-foreground">আমি বাংলা ও English দুটোতেই কথা বলি।</p>
          </div>
          <div
            className="flex flex-wrap justify-center gap-2 animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => start(s)}
                className="glass rounded-full px-3.5 py-2 text-[13px] text-secondary-foreground transition-all hover:border-primary/50 hover:bg-surface-strong active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      </main>

      <div className="px-3 pb-3">
        <Composer onSend={start} onListeningChange={setListening} allowImages={false} />
      </div>
    </>
  );
}
