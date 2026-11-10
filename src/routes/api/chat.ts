import { createFileRoute } from "@tanstack/react-router";

import { handleLiliChat } from "@/lib/ai/lili-chat.server";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: ({ request }) => handleLiliChat(request),
    },
  },
});
