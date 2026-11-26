"use client";
import { DateField } from "@/components/ui/date-field";
import * as React from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ItemsEditor, type ItemInit, type ServiceOpt, type Totals } from "@/components/items/items-editor";
import { money } from "@/lib/utils";
import type { Result } from "@/lib/action";

export type QuoteInitial = {
  client_id?: string | null; client_name?: string | null; client_phone?: string | null; valid_until?: string | null;
  lang?: string; discount?: number; notes?: string | null; internal_notes?: string | null;
};

export function QuoteForm({
  action, clients, services, initial = {}, initialItems, submitLabel, mode = "quote",
}: {
  mode?: "quote" | "invoice";
  action: (fd: FormData) => Promise<Result<unknown>>; clients: { id: string; name: string }[]; services: ServiceOpt[];
  initial?: QuoteInitial; initialItems?: ItemInit[]; submitLabel: string;
}) {
  const [client, setClient] = React.useState(initial.client_id ?? "");
  const [totals, setTotals] = React.useState<Totals>({ govt: 0, fee: 0, total: 0 });
  const [disc, setDisc] = React.useState(String(initial.discount ?? 0));
  const defaultValid = React.useMemo(() => initial.valid_until ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), [initial.valid_until]);
  return (
    <ActionForm action={action} submitLabel={submitLabel} resetOnSuccess={false}>
      <section className="rounded-card border border-line p-4">
        <h3 className="mb-3 text-base font-semibold">{mode === "invoice" ? "لمن هذه الفاتورة؟" : "لمن هذا العرض؟"}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="العميل" className="sm:col-span-2">
            <Select name="client_id" value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="">— ليس عميلاً مسجلاً (اكتب اسمه فقط) —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          {!client && (
            <>
              <Field label="الاسم"><Input name="client_name" defaultValue={initial.client_name ?? ""} required /></Field>
              <Field label="الهاتف"><Input name="client_phone" defaultValue={initial.client_phone ?? ""} dir="ltr" className="text-start" inputMode="tel" /></Field>
            </>
          )}
          {mode === "quote" && <Field label="صالح حتى"><DateField name="valid_until" defaultValue={defaultValid} /></Field>}
          <Field label={mode === "invoice" ? "لغة الفاتورة عند الطباعة" : "لغة العرض عند الطباعة"}>
            <Select name="lang" defaultValue={initial.lang ?? "both"}>
              <option value="both">عربي + English</option><option value="ar">العربية فقط</option><option value="en">English only</option>
            </Select>
          </Field>
        </div>
      </section>

      <section className="rounded-card border border-line p-4">
        <h3 className="mb-1 text-base font-semibold">الخدمات والأسعار</h3>
        <p className="mb-3 text-sm text-ink-3">اختر الخدمة من القائمة فتمتلئ أسعارها، أو أضف بنداً يدوياً.</p>
        <ItemsEditor services={services} initial={initialItems} onTotals={setTotals} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="خصم (اختياري)"><Input name="discount" type="number" min="0" step="0.01" value={disc} onChange={(e) => setDisc(e.target.value)} dir="ltr" className="text-start" inputMode="decimal" /></Field>
          <div className="flex items-end"><div className="flex w-full items-center justify-between rounded-ctl bg-navy-soft px-4 py-2.5"><span className="text-[15px] font-medium text-navy">{mode === "invoice" ? "إجمالي الفاتورة" : "إجمالي العرض"}</span><span className="text-xl font-bold text-navy num">{money(Math.max(0, totals.total - Number(disc || 0)))}</span></div></div>
        </div>
      </section>

      <section className="grid gap-3 rounded-card border border-line p-4 sm:grid-cols-2">
        <Field label={mode === "invoice" ? "ملاحظات تظهر في الفاتورة" : "ملاحظات تظهر في عرض السعر"}><Textarea name="notes" defaultValue={initial.notes ?? ""} /></Field>
        <Field label="ملاحظات للمكتب فقط" hint="لا تُطبع"><Textarea name="internal_notes" defaultValue={initial.internal_notes ?? ""} /></Field>
      </section>
    </ActionForm>
  );
}
