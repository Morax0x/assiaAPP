import { cn } from "@/lib/utils";

const tones = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  mute: "bg-mute-soft text-mute",
  navy: "bg-navy-soft text-navy",
  orange: "bg-orange-soft text-orange-hover",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "mute", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  new: "navy",
  in_progress: "warn",
  awaiting_docs: "orange",
  completed: "ok",
  cancelled: "mute",
  paid: "ok",
  partial: "warn",
  unpaid: "bad",
  expired: "bad",
  critical: "warn",
  upcoming: "navy",
  valid: "ok",
};
