"use client";
import * as React from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { TXN_STATUS_LABEL, METHOD_LABEL } from "@/lib/permissions";
import { money } from "@/lib/utils";
import type { Result } from "@/lib/action";

export type Opt = { id: string; name: string };
export type TemplateOpt = Opt & { default_govt_fee: number; default_office_fee: number };
export type AccountOpt = Opt & { kind: string };
export type TxnInitial = {
  client_id?: string; title?: string; template_id?: string | null; assignee_id?: string | null;
  govt_fees?: number; office_fee?: number; discount?: number; due_date?: string | null;
  status?: string; internal_notes?: string | null;
};

export function TransactionForm({
  action, clients, templates, staff, accounts, initial = {}, mode, submitLabel,
}: {
  action: (fd: FormData) => Promise<Result<unknown>>;
  clients: Opt[]; templates: TemplateOpt[]; staff: Opt[]; accounts?: AccountOpt[];
  initial?: TxnInitial; mode: "new" | "edit"; submitLabel: string;
}) {
  const [govt, setGovt] = React.useState(String(initial.govt_fees ?? 0));
  const [fee, setFee] = React.useState(String(initial.office_fee ?? 0));
  const [disc, setDisc] = React.useState(String(initial.discount ?? 0));
  const [title, setTitle] = React.useState(initial.title ?? "");
  const [acc, setAcc] = React.useState(accounts?.[0]?.id ?? "");
  const [method, setMethod] = React.useState("cash");
  const total = Math.max(0, Number(govt || 0) + Number(fee || 0) - Number(disc || 0));

  function pickTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setGovt(String(t.default_govt_fee));
    setFee(String(t.default_office_fee));
    if (!title) setTitle(t.name);
  }
  function pickAccount(id: string) {
    setAcc(id);
    const k = accounts?.find((a) => a.id === id)?.kind;
    setMethod(k === "bank" ? "bank_card" : "cash");
  }

  return (
    <ActionForm action={action} submitLabel={submitLabel} resetOnSuccess={mode === "edit"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العميل">
          <Select name="client_id" defaultValue={initial.client_id ?? ""} required>
            <option value="">اختر العميل</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="قالب الخدمة" hint="يعبّئ الرسوم والأتعاب تلقائياً">
          <Select name="template_id" defaultValue={initial.template_id ?? ""} onChange={(e) => pickTemplate(e.target.value)}>
            <option value="">بدون قالب</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="عنوان المعاملة" className="sm:col-span-2">
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="الموظف المسؤول">
          <Select name="assignee_id" defaultValue={initial.assignee_id ?? ""}>
            <option value="">غير محدد</option>
            {staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="الحالة">
          <Select name="status" defaultValue={initial.status ?? "new"}>
            {Object.entries(TXN_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="تاريخ الاستحقاق / التسليم">
          <Input name="due_date" type="date" defaultValue={initial.due_date ?? ""} dir="ltr" className="text-start" />
        </Field>
      </div>

      <fieldset className="rounded-card border border-line p-3">
        <legend className="px-1 text-xs font-medium text-ink-3">الهيكلة المالية</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="الرسوم الحكومية / التكلفة" hint="تمر عبر المكتب، ليست ربحاً">
            <Input name="govt_fees" type="number" step="0.01" min="0" value={govt} onChange={(e) => setGovt(e.target.value)} dir="ltr" className="text-start" />
          </Field>
          <Field label="أتعاب المكتب" hint="صافي ربح المكتب">
            <Input name="office_fee" type="number" step="0.01" min="0" value={fee} onChange={(e) => setFee(e.target.value)} dir="ltr" className="text-start" />
          </Field>
          <Field label="خصم">
            <Input name="discount" type="number" step="0.01" min="0" value={disc} onChange={(e) => setDisc(e.target.value)} dir="ltr" className="text-start" />
          </Field>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-md bg-bg px-3 py-2 text-sm">
          <span className="text-ink-2">الإجمالي على العميل</span>
          <span className="text-base font-semibold num">{money(total)}</span>
        </div>
      </fieldset>

      {mode === "new" && accounts && accounts.length > 0 && (
        <fieldset className="rounded-card border border-line p-3">
          <legend className="px-1 text-xs font-medium text-ink-3">دفعة مقدمة (اختياري)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="المبلغ المستلم">
              <Input name="init_amount" type="number" step="0.01" min="0" defaultValue="" dir="ltr" className="text-start" />
            </Field>
            <Field label="الحساب">
              <Select name="init_account" value={acc} onChange={(e) => pickAccount(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="وسيلة الدفع">
              <Select name="init_method" value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
          </div>
        </fieldset>
      )}

      <Field label="ملاحظات داخلية" hint="لا تظهر للعميل ولا في روابط المشاركة">
        <Textarea name="internal_notes" defaultValue={initial.internal_notes ?? ""} />
      </Field>
    </ActionForm>
  );
}
