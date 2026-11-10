import type { ReactNode } from "react";
import { createFileRoute, Link, useHydrated } from "@tanstack/react-router";
import { Brain, Languages, MessageSquareText, Mic, PlugZap, Shield, Sparkle, User } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/lili/AppShell";
import { LiliAvatar } from "@/components/lili/LiliAvatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  clearAllThreads,
  updateSettings,
  useSettings,
  useThreads,
  type Settings,
} from "@/lib/lili-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LILI AI" },
      {
        name: "description",
        content: "Personalize Lili's tone, language, voice input and chat preferences.",
      },
      { property: "og:title", content: "Settings — LILI AI" },
      {
        property: "og:description",
        content: "Personalize Lili's tone, language, voice input and chat preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const hydrated = useHydrated();
  const s = useSettings();
  const threads = useThreads();

  return (
    <>
      <PageHeader title="Settings" subtitle="সেটিংস · personalize Lili" />
      <main className="min-h-0 flex-1 space-y-5 overflow-y-auto scrollbar-none px-4 pb-6">
        <div className="glass flex items-center gap-4 rounded-3xl p-4 animate-fade-up">
          <LiliAvatar size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-foreground">Lili</p>
            <p className="text-xs text-muted-foreground">Your bilingual personal assistant</p>
          </div>
        </div>

        {hydrated && (
          <>
            <Section icon={User} title="Profile">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  What should Lili call you?
                </span>
                <input
                  value={s.userName}
                  onChange={(e) => updateSettings({ userName: e.target.value })}
                  placeholder="Your name / আপনার নাম"
                  maxLength={40}
                  className="h-11 w-full rounded-xl border border-input bg-muted px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </label>
            </Section>

            {/* Lili's Memory Section */}
            <Section icon={Brain} title="Memory">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Manage what Lili remembers about you across conversations.
                </p>
                <Button asChild variant="outline" className="w-full rounded-xl justify-between border-primary/30 hover:bg-primary/10">
                  <Link to="/memory">
                    <span className="flex items-center gap-2 font-medium">
                      <Brain className="size-4 text-primary" />
                      View & Edit Lili's Memory
                    </span>
                    <span className="text-muted-foreground">→</span>
                  </Link>
                </Button>
              </div>
            </Section>

            <Section icon={Sparkle} title="Personality">
              <Field label="Tone">
                <Segmented<Settings["tone"]>
                  value={s.tone}
                  onChange={(tone) => updateSettings({ tone })}
                  options={[
                    { value: "friendly", label: "Friendly" },
                    { value: "professional", label: "Formal" },
                    { value: "playful", label: "Playful" },
                  ]}
                />
              </Field>
              <Field label="Reply length">
                <Segmented<Settings["replyLength"]>
                  value={s.replyLength}
                  onChange={(replyLength) => updateSettings({ replyLength })}
                  options={[
                    { value: "short", label: "Short" },
                    { value: "balanced", label: "Balanced" },
                    { value: "detailed", label: "Detailed" },
                  ]}
                />
              </Field>
            </Section>

            <Section icon={Languages} title="Language">
              <Field label="Lili replies in">
                <Segmented<Settings["replyLanguage"]>
                  value={s.replyLanguage}
                  onChange={(replyLanguage) => updateSettings({ replyLanguage })}
                  options={[
                    { value: "bn", label: "বাংলা" },
                    { value: "en", label: "English" },
                    { value: "mix", label: "Mixed" },
                  ]}
                />
              </Field>
            </Section>

            <Section icon={Mic} title="Voice input">
              <Field label="I'll speak in">
                <Segmented<Settings["voiceLang"]>
                  value={s.voiceLang}
                  onChange={(voiceLang) => updateSettings({ voiceLang })}
                  options={[
                    { value: "bn-BD", label: "বাংলা" },
                    { value: "en-US", label: "English" },
                  ]}
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Uses your browser's speech recognition. Works best in Chrome on Android.
              </p>
            </Section>

            <Section icon={MessageSquareText} title="Chat">
              <ToggleRow
                label="Send with Enter"
                hint="Shift + Enter adds a new line"
                checked={s.sendOnEnter}
                onChange={(sendOnEnter) => updateSettings({ sendOnEnter })}
              />
              <ToggleRow
                label="Show message times"
                checked={s.showTimestamps}
                onChange={(showTimestamps) => updateSettings({ showTimestamps })}
              />
            </Section>

            <Section icon={PlugZap} title="AI connection">
              <div className="flex items-start gap-3 rounded-2xl border border-cyan/25 bg-cyan/10 p-3.5">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-cyan" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-cyan">Connected · Lovable AI</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Lili's replies are generated by AI through a secure server. Your tone, language
                    and length choices above are applied to every reply.
                  </p>
                </div>
              </div>
            </Section>

            <Section icon={Shield} title="Data & privacy">
              <p className="text-xs text-muted-foreground">
                {threads.length} conversation{threads.length === 1 ? "" : "s"} saved on this device
                only.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-destructive/40 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={threads.length === 0}
                  >
                    Clear all chat history
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[90vw] rounded-3xl sm:max-w-sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all conversations?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes every chat saved on this device. It can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        clearAllThreads();
                        toast.success("Chat history cleared");
                      }}
                    >
                      Delete all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Section>
          </>
        )}
      </main>
    </>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="glass space-y-4 rounded-3xl p-4 animate-fade-up">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-primary-glow">
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" className="flex gap-1 rounded-2xl bg-muted p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 flex-1 rounded-xl text-[13px] font-semibold transition-all duration-300",
              active
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>
        <span className="block text-sm text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
                  }
