"use client";
import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";
type Fs = "sm" | "md" | "lg";

function apply(theme: Theme, fs: Fs) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.fs = fs;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#0b1220" : "#204f89");
}

function read<T extends string>(key: string, fallback: T, allowed: T[]): T {
  try { const v = localStorage.getItem(key) as T | null; return v && allowed.includes(v) ? v : fallback; } catch { return fallback; }
}

export function useDisplayPrefs() {
  const [theme, setTheme] = React.useState<Theme>("light");
  const [fs, setFs] = React.useState<Fs>("md");
  React.useEffect(() => {
    setTheme(read<Theme>("theme", "light", ["system", "light", "dark"]));
    setFs(read<Fs>("fs", "md", ["sm", "md", "lg"]));
  }, []);
  React.useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system", fs);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme, fs]);
  const set = (t: Theme, f: Fs) => {
    setTheme(t); setFs(f);
    try { localStorage.setItem("theme", t); localStorage.setItem("fs", f); } catch {}
    apply(t, f);
  };
  return { theme, fs, setTheme: (t: Theme) => set(t, fs), setFs: (f: Fs) => set(theme, f) };
}

const THEMES: { key: Theme; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "فاتح", icon: Sun },
  { key: "dark", label: "داكن", icon: Moon },
  { key: "system", label: "تلقائي", icon: Monitor },
];
const SIZES: { key: Fs; label: string; cls: string }[] = [
  { key: "sm", label: "صغير", cls: "text-[13px]" },
  { key: "md", label: "متوسط", cls: "text-[16px]" },
  { key: "lg", label: "كبير", cls: "text-[20px]" },
];

/** Full panel (used in the mobile drawer and the settings page). */
export function DisplayPanel({ className, compact }: { className?: string; compact?: boolean }) {
  const { theme, fs, setTheme, setFs } = useDisplayPrefs();
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <div className="mb-1.5 text-xs font-medium text-ink-2">المظهر</div>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.key} onClick={() => setTheme(t.key)} aria-pressed={theme === t.key}
              className={cn("flex flex-col items-center justify-center gap-0.5 rounded-ctl border text-xs", compact ? "h-9" : "h-11", theme === t.key ? "border-navy bg-navy-soft font-semibold text-navy" : "border-line text-ink-2 hover:bg-mute-soft")}
            >
              <t.icon className="size-4" strokeWidth={1.75} />{t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-ink-2">حجم الخط</div>
        <div className="grid grid-cols-3 gap-2">
          {SIZES.map((s) => (
            <button
              key={s.key} onClick={() => setFs(s.key)} aria-pressed={fs === s.key}
              className={cn("flex items-center justify-center rounded-ctl border font-semibold", compact ? "h-9" : "h-11", compact ? "text-[13px]" : s.cls, fs === s.key ? "border-navy bg-navy-soft text-navy" : "border-line text-ink-2 hover:bg-mute-soft")}
            >
              أ
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Top bar: light / dark toggle only (text size lives in the side menu). */
export function TopbarDisplay() {
  const { theme, setTheme } = useDisplayPrefs();
  const isDark = typeof document !== "undefined" ? document.documentElement.dataset.theme === "dark" : false;
  return (
    <div className="flex items-center">
      <button
        onClick={() => setTheme(isDark || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "light" : "dark")}
        className="flex size-10 items-center justify-center rounded-md text-ink-2 hover:bg-mute-soft"
        aria-label="تبديل الوضع الداكن" title="الوضع الداكن / الفاتح"
      >
        <Moon className="size-5 dark-hide" strokeWidth={1.75} />
        <Sun className="size-5 dark-show" strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** Small text-size control for the desktop side menu. */
export function FontSizeMini() {
  const { fs, setFs } = useDisplayPrefs();
  return (
    <div className="mb-2 flex items-center gap-1 px-1" role="group" aria-label="حجم الخط">
      <span className="me-auto text-[11px] text-ink-3">حجم الخط</span>
      {SIZES.map((s) => (
        <button key={s.key} onClick={() => setFs(s.key)} aria-pressed={fs === s.key} aria-label={s.label}
          className={cn("flex size-7 items-center justify-center rounded-md border font-semibold", s.key === "sm" ? "text-[11px]" : s.key === "md" ? "text-[13px]" : "text-[16px]", fs === s.key ? "border-navy bg-navy-soft text-navy" : "border-line text-ink-2 hover:bg-mute-soft")}>
          أ
        </button>
      ))}
    </div>
  );
}
