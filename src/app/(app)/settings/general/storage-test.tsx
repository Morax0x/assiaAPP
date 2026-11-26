"use client";
import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { testStorage } from "@/modules/files/actions";

export function StorageTest() {
  const [busy, setBusy] = React.useState(false);
  const [steps, setSteps] = React.useState<{ name: string; ok: boolean; note?: string }[] | null>(null);
  const [err, setErr] = React.useState("");
  return (
    <div className="space-y-3">
      <Button variant="outline" disabled={busy} onClick={async () => {
        setBusy(true); setErr(""); setSteps(null);
        const r = await testStorage();
        setBusy(false);
        if (!r.ok) setErr(r.error); else setSteps(r.data!.steps);
      }}>{busy ? "جارٍ الفحص..." : "فحص إعدادات التخزين"}</Button>
      {err && <p className="text-sm text-bad">{err}</p>}
      {steps && (
        <ul className="space-y-1.5 text-sm">
          {steps.map((s) => (
            <li key={s.name} className={`flex items-start gap-2 ${s.ok ? "text-ok" : "text-bad"}`}>
              {s.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
              <span>{s.name}{s.note ? <span className="block text-xs opacity-90" dir="ltr" style={{ textAlign: "start" }}>{s.note}</span> : null}</span>
            </li>
          ))}
          {steps.every((s) => s.ok) && <li className="text-xs text-ink-3">الخادم يصل للمخزن بنجاح. إن بقي الرفع من المتصفح يفشل فالسبب قاعدة CORS في Cloudflare (يجب أن تحتوي عنوان موقعك بالضبط).</li>}
        </ul>
      )}
    </div>
  );
}
