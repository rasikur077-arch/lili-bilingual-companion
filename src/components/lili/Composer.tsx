import { useEffect, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Mic, Square, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSpeechInput } from "@/hooks/use-speech-input";
import { useSettings } from "@/lib/lili-store";
import { stopSpeaking } from "@/lib/lili-tts";
import { cn } from "@/lib/utils";

type Props = {
  onSend: (text: string, files: File[]) => void;
  onListeningChange?: (listening: boolean) => void;
  autoFocus?: boolean;
  placeholder?: string;
  busy?: boolean;
  onStop?: () => void;
  allowImages?: boolean;
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function Composer({
  onSend,
  onListeningChange,
  autoFocus = true,
  placeholder,
  busy = false,
  onStop,
  allowImages = true,
}: Props) {
  const settings = useSettings();
  const [value, setValue] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseRef = useRef("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeechInput({
    lang: settings.voiceLang,
    onTranscript: (t) => setValue(`${baseRef.current ? `${baseRef.current} ` : ""}${t}`),
    onError: (msg) => toast.error(msg),
  });

  useEffect(() => {
    onListeningChange?.(speech.listening);
    if (!speech.listening) taRef.current?.focus();
  }, [speech.listening, onListeningChange]);

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [value]);

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  const chooseImages = (files: File[]) => {
    const valid: File[] = [];
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast.error("শুধু JPG, PNG, WebP বা GIF ছবি দিন।");
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error("প্রতিটি ছবি ৫ MB বা তার কম হতে হবে।");
        continue;
      }
      valid.push(file);
    }
    setImages((current) => {
      const combined = [...current, ...valid];
      if (combined.length > 3) toast.error("একবারে সর্বোচ্চ ৩টি ছবি পাঠানো যাবে।");
      return combined.slice(0, 3);
    });
  };

  const submit = () => {
    const text = value.trim();
    if ((!text && images.length === 0) || busy) return;
    if (speech.listening) speech.stop();
    onSend(text, images);
    setValue("");
    setImages([]);
    baseRef.current = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    taRef.current?.focus();
  };

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      baseRef.current = value.trim();
      stopSpeaking();
      speech.start();
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="glass flex flex-col gap-2 rounded-[1.75rem] p-2 shadow-soft"
    >
      {allowImages && images.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pt-1" aria-label="Selected images">
          {images.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`} className="relative">
              {previewUrls[index] && (
                <img
                  src={previewUrls[index]}
                  alt={file.name || `Selected image ${index + 1}`}
                  className="size-16 rounded-xl border border-border object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-background text-foreground shadow"
                aria-label={`Remove ${file.name || `image ${index + 1}`}`}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {allowImages && <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          aria-label="Choose images"
          onChange={(event) => {
            chooseImages(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
        />}
        {allowImages && <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="shrink-0 text-muted-foreground"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || images.length >= 3}
          aria-label="Attach images"
          title="ছবি যুক্ত করুন"
        >
          <ImagePlus className="!size-5" />
        </Button>}

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
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && settings.sendOnEnter) {
                  event.preventDefault();
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
            disabled={(!value.trim() && images.length === 0) || busy}
            aria-label="Send message"
            className="shrink-0"
          >
            <ArrowUp className="!size-5" />
          </Button>
        )}
      </div>
    </form>
  );
}
