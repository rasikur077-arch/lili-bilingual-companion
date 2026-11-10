import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { History, MessageCircle, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Chat", icon: MessageCircle },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-aurora sm:border-x sm:border-border">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}

function BottomNav() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const isTabActive = (to: string) =>
    to === "/" ? pathname === "/" || pathname.startsWith("/chat") : pathname.startsWith(to);
  return (
    <nav aria-label="Main" className="glass relative z-10 border-x-0 border-b-0 px-4 pt-2 pb-safe">
      <ul className="flex items-center justify-around">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              aria-current={isTabActive(to) ? "page" : undefined}
              className={cn(
                "group flex flex-col items-center gap-1 px-4 py-1.5 text-muted-foreground transition-colors",
                isTabActive(to) && "text-foreground",
              )}
            >
              {() => (
                <>
                  <span
                    className={cn(
                      "grid h-8 w-14 place-items-center rounded-full transition-all duration-300",
                      isTabActive(to) && "bg-gradient-primary shadow-glow text-primary-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="text-[11px] font-semibold tracking-wide">{label}</span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  left,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 px-4 pt-4 pb-3">
      {left}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {right}
    </header>
  );
}

export function AiStatusPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-[11px] font-semibold text-cyan">
      <span className="relative flex size-1.5">
        <span className="absolute inset-0 rounded-full bg-cyan animate-pulse-ring" />
        <span className="relative size-1.5 rounded-full bg-cyan" />
      </span>
      Lili is online
    </span>
  );
}
