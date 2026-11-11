import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronLeft, Trash2, Plus, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/lili/AppShell";
import { Button } from "@/components/ui/button";
import { LiliAvatar } from "@/components/lili/LiliAvatar";
import {
  getLiliMemories,
  saveLiliMemory,
  deleteLiliMemory,
  clearLiliMemories,
  type LiliMemory,
} from "@/lib/lili-memory";

export const Route = createFileRoute("/Memory")({
  head: () => ({
    meta: [
      { title: "Memory Management — LILI AI" },
      { name: "description", content: "Manage what Lili remembers about you." },
    ],
  }),
  component: MemoryPage,
});

function MemoryPage() {
  const [memories, setMemories] = useState<LiliMemory[]>([]);
  const [newContent, setNewContent] = useState("");

  useEffect(() => {
    setMemories(getLiliMemories());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    const updated = saveLiliMemory(newContent);
    setMemories(updated);
    setNewContent("");
  };

  const handleDelete = (id: string) => {
    const updated = deleteLiliMemory(id);
    setMemories(updated);
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all memories?")) {
      clearLiliMemories();
      setMemories([]);
    }
  };

  return (
    <div className="flex flex-1 flex-col pb-6">
      <PageHeader
        left={
          <Button variant="glass" size="icon" className="rounded-full" asChild>
            <Link to="/" aria-label="Back to home">
              <ChevronLeft />
            </Link>
          </Button>
        }
        title={
          <span className="flex items-center gap-2">
            <LiliAvatar size="sm" />
            <span>Lili's Memory</span>
          </span>
        }
      />

      <div className="px-4 py-4 max-w-lg mx-auto w-full flex flex-col gap-6">
        <div className="glass p-4 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Personal Memory</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Lili remembers these facts across chats to assist you better. Stored securely on your device (localStorage).
          </p>
        </div>

        {/* Add Memory Form */}
        <form onSubmit={handleSave} className="flex gap-2">
          <input
            type="text"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add something for Lili to remember..."
            className="flex-1 bg-background/50 border border-border/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={500}
          />
          <Button type="submit" variant="glow" size="icon" className="rounded-xl shrink-0">
            <Plus className="w-4 h-4" />
          </Button>
        </form>

        {/* Memories List */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Saved Memories ({memories.length})
            </span>
            {memories.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-destructive hover:underline font-medium"
              >
                Clear All
              </button>
            )}
          </div>

          {memories.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm glass rounded-2xl p-6">
              No memories saved yet. Add one above or tell Lili to remember something!
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="glass p-3.5 rounded-xl flex items-center justify-between gap-3 text-sm"
                >
                  <span className="break-all">{m.content}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    aria-label="Delete memory"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
    }
