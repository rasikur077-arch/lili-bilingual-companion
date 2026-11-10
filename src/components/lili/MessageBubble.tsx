import { CircleAlert } from "lucide-react";
import { format } from "date-fns";

import { LiliAvatar } from "@/components/lili/LiliAvatar";
import { messageText, type ChatMessage } from "@/lib/lili-store";
import { cn } from "@/lib/utils";

export function MessageBubble({
  message,
  showTime,
}: {
  message: ChatMessage;
  showTime: boolean;
}) {
  const text = messageText(message);
  const time = showTime ? format(message.createdAt, "h:mm a") : null;

  if (message.role === "notice") {
    return (
      <div className="flex justify-center animate-message-in" role="status">
        <div className="flex max-w-[90%] items-start gap-2 rounded-2xl border border-warning/25 bg-warning/10 px-3.5 py-2.5 text-xs leading-5 text-warning">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{text}</span>
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1 animate-message-in">
        <div className="max-w-[82%] whitespace-pre-wrap break-words rounded-3xl rounded-br-md bg-gradient-primary px-4 py-3 text-[15px] leading-6 text-primary-foreground shadow-glow">
          {text}
        </div>
        {time && <span className="pr-2 text-[11px] text-muted-foreground">{time}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 animate-message-in">
      <LiliAvatar size="sm" />
      <div className="flex max-w-[82%] flex-col gap-1">
        <div
          className={cn(
            "glass whitespace-pre-wrap break-words rounded-3xl rounded-bl-md px-4 py-3 text-[15px] leading-6 text-foreground",
          )}
        >
          {text}
        </div>
        {time && <span className="pl-2 text-[11px] text-muted-foreground">{time}</span>}
      </div>
    </div>
  );
}
