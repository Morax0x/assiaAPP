"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, CirclePause } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setTransactionStatus } from "@/modules/transactions/actions";

const STEPS = [
  { key: "new", label: "جديدة" },
  { key: "in_progress", label: "قيد الإجراء" },
  { key: "completed", label: "مكتملة" },
] as const;

export function StatusStepper({ id, status, canWrite }: { id: string; status: string; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const idx = status === "completed" ? 2 : status === "new" ? 0 : 1;
  const waiting = status === "awaiting_docs";

  const go = (to: string, msg: string) =>
    start(async () => {
      const r = await setTransactionStatus(id, to);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(msg);
      router.refresh();
    });

  if (status === "cancelled") {
    return <div className="rounded-card border border-line bg-mute-soft px-4 py-3 text-[15px] font-medium text-mute">هذه المعاملة ملغاة.</div>;
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <ol className="flex items-center">
        {STEPS.map((s, i) => {
          const done = i < idx || (i === 2 && status === "completed");
          const current = i === idx && status !== "completed";
          return (
            <li key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span className={cn("flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold",
                  done ? "border-ok bg-ok text-white" : current ? "border-navy bg-navy-soft text-navy" : "border-line-strong text-ink-3")}>
                  {done ? <Check className="size-5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("text-[13px] font-semibold", current ? "text-navy" : done ? "text-ok" : "text-ink-3")}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <span className={cn("mx-2 mb-6 h-0.5 flex-1 rounded", i < idx ? "bg-ok" : "bg-line")} />}
            </li>
          );
        })}
      </ol>
      {waiting && (
        <div className="mt-3 flex items-center gap-2 rounded-ctl bg-orange-soft px-3 py-2 text-sm font-medium text-orange-hover">
          <CirclePause className="size-4" strokeWidth={1.75} /> المعاملة متوقفة بانتظار مستندات من العميل
        </div>
      )}
      {canWrite && status !== "completed" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {status === "new" && <Button size="lg" disabled={pending} onClick={() => go("in_progress", "بدأت المعاملة")}>ابدأ العمل على المعاملة</Button>}
          {(status === "in_progress" || waiting) && <Button size="lg" variant="accent" disabled={pending} onClick={() => go("completed", "تم إنجاز المعاملة")}>تمّت المعاملة</Button>}
          {status === "in_progress" && <Button size="lg" variant="outline" disabled={pending} onClick={() => go("awaiting_docs", "تم التحديث")}>بانتظار مستندات من العميل</Button>}
          {waiting && <Button size="lg" variant="outline" disabled={pending} onClick={() => go("in_progress", "عادت قيد الإجراء")}>وصلت المستندات، تابع العمل</Button>}
        </div>
      )}
      {canWrite && status === "completed" && (
        <div className="mt-3"><Button variant="ghost" size="sm" disabled={pending} onClick={() => go("in_progress", "أُعيد فتح المعاملة")}>إعادة فتح المعاملة</Button></div>
      )}
    </div>
  );
}
