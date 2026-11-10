import liliAvatar from "@/assets/lili-avatar.jpg";
import { cn } from "@/lib/utils";

type Props = {
  size?: "sm" | "md" | "lg";
  active?: boolean;
  className?: string;
};

const sizes = {
  sm: "size-8",
  md: "size-12",
  lg: "size-44",
};

export function LiliAvatar({ size = "md", active = false, className }: Props) {
  if (size !== "lg") {
    return (
      <div className={cn("relative shrink-0", sizes[size], className)}>
        <div className="absolute -inset-0.5 rounded-full bg-gradient-glow opacity-80" />
        <img
          src={liliAvatar}
          alt="Lili"
          width={1024}
          height={1024}
          className="relative size-full rounded-full border-2 border-background object-cover"
        />
      </div>
    );
  }

  return (
    <div className={cn("relative grid place-items-center", className)}>
      {/* soft halo */}
      <div className="absolute size-72 rounded-full bg-primary/25 blur-3xl animate-breathe" />
      {/* orbit rings */}
      <div className="absolute size-60 rounded-full border border-primary/30 animate-orbit">
        <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-cyan shadow-glow" />
      </div>
      <div className="absolute size-[17rem] rounded-full border border-dashed border-cyan/20 animate-orbit-reverse">
        <span className="absolute top-1/2 -right-1 size-1.5 -translate-y-1/2 rounded-full bg-primary-glow" />
      </div>
      {active && (
        <>
          <div className="absolute size-44 rounded-full border-2 border-primary-glow animate-pulse-ring" />
          <div
            className="absolute size-44 rounded-full border-2 border-cyan animate-pulse-ring"
            style={{ animationDelay: "0.8s" }}
          />
        </>
      )}
      <div className="relative animate-float">
        <div className="absolute -inset-1 rounded-full bg-gradient-glow" />
        <img
          src={liliAvatar}
          alt="Lili, your AI assistant"
          width={1024}
          height={1024}
          className={cn(
            "relative rounded-full border-4 border-background object-cover",
            sizes.lg,
          )}
        />
      </div>
    </div>
  );
}
