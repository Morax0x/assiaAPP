"use client";
import { DateField } from "@/components/ui/date-field";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function RangePicker({ from, to, basePath = "/reports", extra }: { from: string; to: string; basePath?: string; extra?: Record<string, string> }) {
  const router = useRouter();
  const [f, setF] = React.useState(from);
  const [t, setT] = React.useState(to);
  const go = (a: string, b: string) => {
    const p = new URLSearchParams({ ...(extra ?? {}), from: a, to: b });
    router.push(`${basePath}?${p.toString()}`);
  };
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const presets: [string, string, string][] = [
    ["اليوم", iso(now), iso(now)],
    ["هذا الشهر", iso(new Date(Date.UTC(y, m, 1))), iso(now)],
    ["الشهر الماضي", iso(new Date(Date.UTC(y, m - 1, 1))), iso(new Date(Date.UTC(y, m, 0)))],
    ["آخر 3 أشهر", iso(new Date(Date.UTC(y, m - 2, 1))), iso(now)],
    ["هذه السنة", `${y}-01-01`, iso(now)],
  ];
  return (
    <div className="mb-5 space-y-3 rounded-card border border-line bg-surface p-3">
      <div className="flex flex-wrap gap-1.5">
        {presets.map(([l, a, b]) => (
          <Button key={l} size="sm" variant={a === from && b === to ? "primary" : "outline"} onClick={() => { setF(a); setT(b); go(a, b); }}>{l}</Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-ink-3">من<DateField value={f} onChange={setF} className="mt-1 w-44" /></label>
        <label className="text-xs text-ink-3">إلى<DateField value={t} onChange={setT} className="mt-1 w-44" /></label>
        <Button onClick={() => f && t && go(f, t)}>عرض</Button>
      </div>
    </div>
  );
}
