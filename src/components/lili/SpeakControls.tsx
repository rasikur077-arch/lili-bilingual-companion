import { Pause, Play, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  pauseSpeaking,
  resumeSpeaking,
  speakReply,
  stopSpeaking,
  useSpeakState,
} from "@/lib/lili-tts";
import { cn } from "@/lib/utils";

const btn = "size-7 rounded-full text-muted-foreground hover:text-foreground [&_svg]:size-3.5";

/** Read-aloud controls shown beside each of Lili's replies. */
export function SpeakControls({ id, text }: { id: string; text: string }) {
  const { activeId, status } = useSpeakState();
  const mine = activeId === id && status !== "idle";

  if (!mine) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={btn}
        aria-label="Read aloud"
        title="Read aloud / পড়ে শোনাও"
        onClick={() => void speakReply(id, text, (m) => toast(m))}
      >
        <Volume2 />
      </Button>
    );
  }

  return (
    <span className="flex items-center gap-0.5" role="group" aria-label="Read-aloud controls">
      {status === "speaking" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(btn, "text-primary-glow")}
          aria-label="Pause reading"
          onClick={pauseSpeaking}
        >
          <Pause className="fill-current" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(btn, "text-primary-glow")}
          aria-label="Resume reading"
          onClick={resumeSpeaking}
        >
          <Play className="fill-current" />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={btn}
        aria-label="Stop reading"
        onClick={stopSpeaking}
      >
        <Square className="fill-current" />
      </Button>
      {status === "speaking" && (
        <span className="ml-0.5 flex items-end gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-0.5 origin-bottom rounded-full bg-primary-glow animate-wave"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      )}
    </span>
  );
}
