"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { BellPlus, Check, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionDialog } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Field, Input, Textarea } from "@/components/ui/form";
import { createReminder, deleteReminder, setReminderDone } from "@/modules/reminders/actions";
import { cn, fmtDate } from "@/lib/utils";

export type ReminderRow = { id: string; title: string; note: string | null; remind_date: string; done: boolean };

export function RemindersPanel({ rows }: { rows: ReminderRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return toast.error(r.error ?? "تعذر التنفيذ");
    router.refresh();
  }
  const left = (d: string) => Math.round((new Date(d + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);

  return (
    <Card>
      <CardHeader
        title="تذكيراتي"
        action={
          <ActionDialog trigger={<><BellPlus /> إضافة تذكير</>} title="تذكير جديد" description="اكتب أي تذكير تريده وحدّد تاريخه، ولا يشترط أن يكون مرتبطاً بمستند." action={createReminder} submitLabel="حفظ التذكير" triggerProps={{ size: "sm" }}>
            <Field label="نص التذكير">
              <Input name="title" required placeholder="مثال: الاتصال بالعميل لاستلام الأوراق" />
            </Field>
            <Field label="تاريخ التذكير">
              <DateField name="remind_date" required />
            </Field>
            <Field label="ملاحظات (اختياري)">
              <Textarea name="note" />
            </Field>
          </ActionDialog>
        }
      />
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-ink-3">لا توجد تذكيرات. اضغط «إضافة تذكير» لكتابة تذكير جديد.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const d = left(r.remind_date);
            return (
              <li key={r.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", r.done && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm font-semibold", r.done && "line-through")}>{r.title}</div>
                  {r.note && <div className="mt-0.5 text-xs text-ink-3">{r.note}</div>}
                  <div className="mt-1 text-xs text-ink-3"><span className="num">{fmtDate(r.remind_date)}</span>{!r.done && <> · <span className={d < 0 ? "text-bad" : d <= 3 ? "text-warn" : ""}>{d < 0 ? `متأخر ${-d} يوم` : d === 0 ? "اليوم" : d === 1 ? "غداً" : `بعد ${d} يوم`}</span></>}</div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => run(r.id, () => setReminderDone(r.id, !r.done))}>
                    {r.done ? <><RotateCcw /> إعادة فتح</> : <><Check /> تم</>}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy === r.id} aria-label="حذف" onClick={() => run(r.id, () => deleteReminder(r.id))}><Trash2 /></Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
