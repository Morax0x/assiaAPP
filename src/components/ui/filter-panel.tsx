"use client";
import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Search and filter fields. On a phone they hide behind one big button (browsing is easier); on a computer they are always shown.
 */
export function FilterPanel({ active, onClear, children, label = "بحث وتصفية" }: { active?: boolean; onClear?: () => void; children: React.ReactNode; label?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <div className="flex gap-2 md:hidden">
        <button
          type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className={cn("flex h-11 flex-1 items-center justify-center gap-2 rounded-ctl border text-[15px] font-medium", open || active ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink-2")}
        >
          <SlidersHorizontal className="size-4" strokeWidth={1.9} /> {open ? "إخفاء البحث" : label}{active && !open ? " •" : ""}
        </button>
        {active && onClear && (
          <button type="button" onClick={onClear} aria-label="مسح" className="flex size-11 items-center justify-center rounded-ctl border border-line bg-surface text-ink-2"><X className="size-4" /></button>
        )}
      </div>
      <div className={cn("space-y-2", open ? "mt-2 block" : "hidden md:block")}>{children}</div>
    </div>
  );
}
