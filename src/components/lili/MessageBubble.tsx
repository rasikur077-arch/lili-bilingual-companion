import { CircleAlert, RotateCcw } from "lucide-react";
import { format } from "date-fns";

import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { LiliAvatar } from "@/components/lili/LiliAvatar";
import { SpeakControls } from "@/components/lili/SpeakControls";
import { Button } from "@/components/ui/button";

export function MessageBubble({
  id,
  role,
  text,
  time,
  streaming = false,
}: {
  /** Message id; enables read-aloud controls on Lili's replies. */
  id?: string;
  role: "user" | "assistant";
  text: string;
  time?: number | undefined;
  streaming?: boolean;
}) {
  const stamp = time ? format(time, "h:mm a") : null;

  if (role === "user") {
    return (
      <Message from="user" className="max-w-full items-end gap-1 animate-message-in">
        <MessageContent className="max-w-[82%] whitespace-pre-wrap break-words rounded-3xl rounded-br-md bg-gradient-primary px-4 py-3 text-[15px] leading-6 text-primary-foreground shadow-glow group-[.is-user]:rounded-3xl group-[.is-user]:rounded-br-md group-[.is-user]:bg-gradient-primary group-[.is-user]:text-primary-foreground">
          {text}
        </MessageContent>
        {stamp && <span className="pr-2 text-[11px] text-muted-foreground">{stamp}</span>}
      </Message>
    );
  }

  return (
    <Message from="assistant" className="max-w-full flex-row items-end gap-2 animate-message-in">
      <LiliAvatar size="sm" />
      <div className="flex min-w-0 max-w-[82%] flex-col gap-1">
        <MessageContent className="glass w-fit max-w-full break-words rounded-3xl rounded-bl-md px-4 py-3 text-[15px] leading-6 text-foreground">
          <MessageResponse className="lili-markdown" isAnimating={streaming}>
            {text}
          </MessageResponse>
        </MessageContent>
        {!streaming && (id || stamp) && (
          <div className="flex items-center gap-1 pl-1">
            {id && <SpeakControls id={id} text={text} />}
            {stamp && <span className="pl-1 text-[11px] text-muted-foreground">{stamp}</span>}
          </div>
        )}
      </div>
    </Message>
  );
}

/** Shown while Lili is thinking, before any reply text has arrived. */
export function ThinkingBubble({ language }: { language: "bn" | "en" | "mix" }) {
  return (
    <div className="flex items-end gap-2 animate-message-in" role="status" aria-live="polite">
      <div className="relative">
        <span className="absolute inset-0 rounded-full border-2 border-primary-glow animate-pulse-ring" />
        <LiliAvatar size="sm" />
      </div>
      <div className="glass flex items-center gap-3 rounded-3xl rounded-bl-md px-4 py-3">
        <span className="flex items-end gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-3.5 w-1 origin-bottom rounded-full bg-primary-glow animate-wave"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
        <Shimmer className="text-sm" duration={1.6}>
          {language === "en" ? "Lili is thinking…" : "লিলি ভাবছে…"}
        </Shimmer>
      </div>
    </div>
  );
}

export function ErrorBubble({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex justify-center animate-message-in" role="alert">
      <div className="flex w-full max-w-[92%] flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5">
        <div className="flex items-start gap-2 text-sm leading-5 text-destructive">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </div>
        <Button
          variant="glass"
          size="sm"
          className="self-end rounded-full"
          onClick={onRetry}
        >
          <RotateCcw /> Try again
        </Button>
      </div>
    </div>
  );
}
