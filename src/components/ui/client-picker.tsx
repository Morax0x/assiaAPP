"use client";
import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const AR = "٠١٢٣٤٥٦٧٨٩";
const norm = (s: string) => s.replace(/[ً-ٰٟـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[٠-٩]/g, (d) => String(AR.indexOf(d))).toLowerCase();

type Opt = { id: string; name: string; kind?: string; phone?: string | null };

/** Searchable client chooser: type a few letters of the name and pick. Works with many clients. */
export function ClientPicker({
  clients, value, onChange, name, emptyLabel, placeholder = "اكتب جزءاً من الاسم للبحث", required,
}: {
  clients: Opt[]; value: string; onChange: (id: string) => void; name?: string; emptyLabel?: string; placeholder?: string; required?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const box = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", on);
    return () => document.removeEventListener("mousedown", on);
  }, [open]);
  const selected = clients.find((c) => c.id === value);
  const list = React.useMemo(() => {
    const t = norm(q.trim());
    const f = t ? clients.filter((c) => norm(c.name).includes(t) || (c.phone ?? "").includes(t)) : clients;
    return f.slice(0, 60);
  }, [clients, q]);
  const pick = (id: string) => { onChange(id); setOpen(false); setQ(""); };

  return (
    <div ref={box} className="relative">
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <button
        type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-ctl border border-line-strong bg-surface px-3 text-start text-[15px]"
      >
        <span className={cn("truncate", !selected && "text-ink-3")} dir="auto">{selected ? selected.name : emptyLabel ?? "اختر العميل"}</span>
        <ChevronDown className="size-4 shrink-0 text-ink-3" />
      </button>
      {open && (
        <div className="absolute inset-x-0 z-30 mt-1 overflow-hidden rounded-card border border-line bg-surface shadow-lg">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute start-5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
              className="h-10 w-full rounded-ctl border border-line bg-bg ps-9 pe-3 text-[15px]"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {emptyLabel && !q && (
              <li><button type="button" onClick={() => pick("")} className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm text-ink-2 hover:bg-bg">{emptyLabel}</button></li>
            )}
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => pick(c.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-[15px] hover:bg-bg">
                  <span className="min-w-0 flex-1 truncate" dir="auto">{c.name}</span>
                  {c.phone && <span className="text-xs text-ink-3 num" dir="ltr">{c.phone}</span>}
                  {c.id === value && <Check className="size-4 text-navy" />}
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-3 text-center text-sm text-ink-3">لا نتائج</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
