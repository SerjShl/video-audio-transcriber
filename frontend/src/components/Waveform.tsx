import { cn } from "@/lib/utils";

type Props = { bars?: number; className?: string };

export function Waveform({ bars = 5, className }: Props) {
  return (
    <span className={cn("inline-flex items-end gap-[3px]", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-current animate-wave"
          style={{ height: "0.9rem", animationDelay: `${i * 0.11}s` }}
        />
      ))}
    </span>
  );
}
