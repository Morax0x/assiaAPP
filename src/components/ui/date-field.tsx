"use client";
import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Date entry that ALWAYS reads day / month / year (month in the middle), whatever the phone or browser language is.
 * Type 8 digits (e.g. 25112026 becomes 25/11/2026) or tap the calendar. Sends a standard yyyy-mm-dd value.
 */
const AR = "٠١٢٣٤٥٦٧٨٩";
const toDisplay = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
function parse(text: string): string {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const d = +m[1], mo = +m[2], y = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || y > 2200 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function mask(raw: string) {
  const digits = raw.replace(/[٠-٩]/g, (c) => String(AR.indexOf(c))).replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateField({
  name, value, defaultValue, onChange, required, min, max, className, ariaLabel,
}: {
  name?: string; value?: string; defaultValue?: string; onChange?: (iso: string) => void;
  required?: boolean; min?: string; max?: string; className?: string; ariaLabel?: string;
}) {
  const controlled = value !== undefined;
  const [iso, setIso] = React.useState(value ?? defaultValue ?? "");
  const [text, setText] = React.useState(toDisplay(value ?? defaultValue ?? ""));
  const textRef = React.useRef<HTMLInputElement>(null);
  const pickRef = React.useRef<HTMLInputElement>(null);

  // follow outside changes (controlled usage, e.g. quick range buttons)
  React.useEffect(() => {
    if (controlled && value !== iso) { setIso(value ?? ""); setText(toDisplay(value ?? "")); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const outOfRange = (v: string) => (min && v < min) || (max && v > max);
  const validity = (t: string, v: string) => {
    if (!t) return "";
    if (!v) return "اكتب التاريخ هكذا: يوم/شهر/سنة، مثل 25/11/2026";
    if (outOfRange(v)) return max && v > max ? "التاريخ لا يمكن أن يكون في المستقبل" : "التاريخ خارج المدى المسموح";
    return "";
  };
  React.useEffect(() => { textRef.current?.setCustomValidity(validity(text, iso)); });

  function commit(t: string) {
    const v = parse(t);
    const ok = v && !outOfRange(v) ? v : "";
    setText(t); setIso(ok); onChange?.(ok);
  }

  const bad = !!text && !!validity(text, iso);
  return (
    <div className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={iso} />}
      <input
        ref={textRef} type="text" inputMode="numeric" autoComplete="off" dir="ltr" placeholder="يوم/شهر/سنة"
        value={text} onChange={(e) => commit(mask(e.target.value))} required={required} aria-label={ariaLabel ?? "التاريخ"} aria-invalid={bad}
        className={cn("h-11 w-full rounded-ctl border bg-surface pe-3 ps-11 text-start text-[15px] text-ink placeholder:text-ink-3", bad ? "border-bad" : "border-line-strong")}
      />
      <button
        type="button" tabIndex={-1} aria-label="اختيار من التقويم"
        onClick={() => { const p = pickRef.current; if (!p) return; try { p.showPicker(); } catch { p.click(); } }}
        className="absolute start-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:bg-mute-soft hover:text-navy"
      ><CalendarDays className="size-4" strokeWidth={1.75} /></button>
      <input
        ref={pickRef} type="date" tabIndex={-1} aria-hidden value={iso} min={min} max={max}
        onChange={(e) => { if (e.target.value) commit(toDisplay(e.target.value)); }}
        className="pointer-events-none absolute start-0 top-full h-0 w-0 opacity-0"
      />
    </div>
  );
}
