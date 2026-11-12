import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { useSettings } from "@/lib/lili-store";
import { stopSpeaking } from "@/lib/lili-tts";
import { cn } from "@/lib/utils";

type Props = {
  onSend: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
  autoFocus?: boolean;
  placeholder?: string;
  /** True while Lili is replying: sending is blocked and Stop is shown. */
  busy?: boolean;
  onStop?: () => void;
};

export function Composer({
  onSend,
  onListeningChange,
  autoFocus = true,
  placeholder,
  busy = false,
  onStop,
}: Props) {
  const settings = useSettings();
  const [value, setValue] = useState("");
  const baseRef = useRef("");
  const taRef = useRef<HTMLTextAreaElement>(null);


  const speech = useSpeechInput({
    lang: settings.voiceLang,
    onTranscript: (t) => setValue((baseRef.current ? `${baseRef.current} ` : "") + t),
    onError: (msg) => toast.error(msg),
  });

  useEffect(() => {
    onListeningChange?.(speech.listening);
    if (!speech.listening) taRef.current?.focus();
  }, [speech.listening, onListeningChange]);

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  // auto-grow
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    if (speech.listening) speech.stop();
    onSend(text);
    setValue("");
    baseRef.current = "";
    taRef.current?.focus();
  };

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      baseRef.current = value.trim();
      stopSpeaking(); // don't let the mic hear Lili reading aloud
      speech.start();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="glass flex items-end gap-2 rounded-[1.75rem] p-2 shadow-soft"
    >
      <Button
        type="button"
        variant={speech.listening ? "glow" : "ghost"}
        size="icon-lg"
        onClick={toggleMic}
        disabled={!speech.supported || busy}
        title={!speech.supported ? "Voice input is not supported in this browser" : undefined}
        aria-label={speech.listening ? "Stop voice input" : "Start voice input"}
        aria-pressed={speech.listening}
        className={cn("relative shrink-0", !speech.listening && "text-muted-foreground")}
      >
        {speech.listening && (
          <span className="absolute inset-0 rounded-full border-2 border-primary-glow animate-pulse-ring" />
        )}
        {speech.listening ? <Square className="!size-4 fill-current" /> : <Mic className="!size-5" />}
      </Button>

      <div className="flex min-h-12 flex-1 items-center">
        {speech.listening && !value ? (
          <div className="flex h-12 items-center gap-1 px-1" aria-live="polite">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="h-5 w-1 origin-center rounded-full bg-primary-glow animate-wave"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
            <span className="ml-2 text-sm text-muted-foreground">
              {settings.voiceLang === "bn-BD" ? "শুনছি…" : "Listening…"}
            </span>
          </div>
        ) : (
          <textarea
            ref={taRef}
            value={value}
            rows={1}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && settings.sendOnEnter) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder ?? "Message Lili… / লিলিকে লিখুন…"}
            aria-label="Message Lili"
            className="max-h-36 w-full resize-none bg-transparent px-1 py-3 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        )}
      </div>

      {busy && onStop ? (
        <Button
          type="button"
          variant="glow"
          size="icon-lg"
          onClick={onStop}
          aria-label="Stop Lili's reply"
          className="shrink-0"
        >
          <Square className="!size-4 fill-current" />
        </Button>
      ) : (
        <Button
          type="submit"
          variant="glow"
          size="icon-lg"
          disabled={!value.trim() || busy}
          aria-label="Send message"
          className="shrink-0"
        >
          <ArrowUp className="!size-5" />
        </Button>
      )}
    </form>
  );
}
