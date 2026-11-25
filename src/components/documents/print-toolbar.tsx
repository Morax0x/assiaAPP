"use client";
import { ArrowRight, Printer } from "lucide-react";
import type { Lang } from "@/components/documents/document-sheet";

const LANGS: { key: Lang; label: string }[] = [
  { key: "both", label: "عربي + English" },
  { key: "ar", label: "العربية" },
  { key: "en", label: "English" },
];

/** Screen-only bar above the A4 sheet: language, back, and print / save as PDF. */
export function PrintToolbar({ lang, basePath, extra = "", backHref }: { lang: Lang; basePath: string; extra?: string; backHref: string }) {
  return (
    <div className="no-print mx-auto mb-4 flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-3 px-3 print:hidden" dir="rtl">
      <a href={backHref} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-[15px] font-medium text-slate-700 hover:border-[#204f89]"><ArrowRight className="size-4" /> رجوع</a>
      <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm">
        {LANGS.map((l) => (
          <a key={l.key} href={`${basePath}?${extra ? extra + "&" : ""}lang=${l.key}`} className={`rounded-md px-3.5 py-2 text-sm font-medium ${lang === l.key ? "bg-[#204f89] text-white" : "text-slate-600 hover:bg-slate-100"}`}>{l.label}</a>
        ))}
      </div>
      <button onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#f15a27] px-5 text-[15px] font-semibold text-white hover:bg-[#d94a1a]"><Printer className="size-4" /> طباعة / حفظ PDF</button>
    </div>
  );
}
