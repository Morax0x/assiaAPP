"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { TXN_STATUS_LABEL, METHOD_LABEL } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { ItemsEditor, type ItemInit, type ServiceOpt, type Totals } from "@/components/items/items-editor";
import type { Result } from "@/lib/action";

export type Opt = { id: string; name: string };
export type TemplateOpt = ServiceOpt;
export type AccountOpt = Opt & { kind: string };
export type TxnInitial = {
  client_id?: string; title?: string; template_id?: string | null; assignee_id?: string | null;
  govt_fees?: number; office_fee?: number; discount?: number; due_date?: string | null;
  status?: string; internal_notes?: string | null;
};

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">{n}</span>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {hint && <p className="text-sm text-ink-3">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function TransactionForm({
  action, clients, templates, staff, accounts, initial = {}, mode, submitLabel, initialItems,
}: {
  action: (fd: FormData) => Promise<Result<unknown>>;
  clients: Opt[]; templates: TemplateOpt[]; staff: Opt[]; accounts?: AccountOpt[];
  initial?: TxnInitial; mode: "new" | "edit"; submitLabel: string; initialItems?: ItemInit[];
}) {
  const [totals, setTotals] = React.useState<Totals>({ govt: 0, fee: 0, total: 0 });
  const [disc, setDisc] = React.useState(String(initial.discount ?? 0));
  const [acc, setAcc] = React.useState(accounts?.[0]?.id ?? "");
  const [method, setMethod] = React.useState("cash");
  const total = Math.max(0, totals.total - Number(disc || 0));

  function pickAccount(id: string) {
    setAcc(id);
    setMethod(accounts?.find((a) => a.id === id)?.kind === "bank" ? "bank_card" : "cash");
  }

  return (
    <ActionForm action={action} submitLabel={submitLabel} resetOnSuccess={mode === "edit"}>
      <Step n={1} title="لمن هذه المعاملة، وما هي؟">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="العميل" hint="">
            <Select name="client_id" defaultValue={initial.client_id ?? ""} required>
              <option value="">— اختر العميل —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Link href="/clients/new" className="mt-1.5 inline-block text-sm font-medium text-navy hover:underline">العميل غير موجود؟ أضفه أولاً</Link>
          </Field>
          <Field label="عنوان المعاملة (اختياري)" hint="إن تركته فارغاً يُكتب تلقائياً من أول بند" className="sm:col-span-2">
            <Input name="title" defaultValue={initial.title ?? ""} placeholder="مثال: تجديد رخصة شركة النور" />
          </Field>
          {mode === "edit" && (
            <Field label="حالة المعاملة">
              <Select name="status" defaultValue={initial.status ?? "new"}>
                {Object.entries(TXN_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          )}
        </div>
      </Step>

      <Step n={2} title="ما هي الخدمات والمبالغ؟" hint="اختر الخدمة من القائمة فتمتلئ الأسعار تلقائياً، أو أضف بنداً يدوياً. الرسوم الحكومية تدفعها عن العميل وليست ربحاً، أما أتعاب المكتب فهي ربحك.">
        <ItemsEditor services={templates} initial={initialItems} onTotals={setTotals} />
        <div className="mt-3 flex items-center justify-between rounded-ctl bg-navy-soft px-4 py-3">
          <span className="text-[15px] font-medium text-navy">المطلوب من العميل{Number(disc) > 0 ? " (بعد الخصم)" : ""}</span>
          <span className="text-xl font-bold text-navy num">{money(total)}</span>
        </div>
      </Step>

      {mode === "new" && accounts && accounts.length > 0 && (
        <Step n={3} title="هل استلمت مبلغاً الآن؟" hint="اختياري. اتركه فارغاً إن لم يدفع العميل بعد، وسجّل الدفعة لاحقاً من صفحة المعاملة.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="المبلغ المستلم">
              <Input name="init_amount" type="number" step="0.01" min="0" defaultValue="" dir="ltr" className="text-start" inputMode="decimal" />
            </Field>
            <Field label="دخل في أي حساب؟">
              <Select name="init_account" value={acc} onChange={(e) => pickAccount(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="طريقة الدفع">
              <Select name="init_method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          </div>
        </Step>
      )}

      <details className="group rounded-card border border-line" open={mode === "edit"}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold marker:hidden">
          خيارات إضافية (خصم، موظف مسؤول، موعد تسليم، ملاحظات)
          <ChevronDown className="size-5 text-ink-3 transition-transform group-open:rotate-180" strokeWidth={1.75} />
        </summary>
        <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
          <Field label="خصم للعميل">
            <Input name="discount" type="number" step="0.01" min="0" value={disc} onChange={(e) => setDisc(e.target.value)} dir="ltr" className="text-start" inputMode="decimal" />
          </Field>
          <Field label="الموظف المسؤول">
            <Select name="assignee_id" defaultValue={initial.assignee_id ?? ""}>
              <option value="">غير محدد</option>
              {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="موعد التسليم المتوقع">
            <Input name="due_date" type="date" defaultValue={initial.due_date ?? ""} dir="ltr" className="text-start" />
          </Field>
          {mode === "new" && <input type="hidden" name="status" value="new" />}
          <Field label="ملاحظات للمكتب فقط" hint="لا تظهر للعميل" className="sm:col-span-2">
            <Textarea name="internal_notes" defaultValue={initial.internal_notes ?? ""} />
          </Field>
        </div>
      </details>
    </ActionForm>
  );
}
