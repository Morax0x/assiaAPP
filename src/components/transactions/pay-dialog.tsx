"use client";
import { DateField } from "@/components/ui/date-field";
import * as React from "react";
import { Plus } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { ReceiptAttach } from "@/components/ui/receipt-attach";
import { METHOD_LABEL } from "@/lib/permissions";
import type { Result } from "@/lib/action";

type Acc = { id: string; name: string; kind: string };

const REF_LABEL: Record<string, string> = {
  bank_transfer: "رقم الحوالة / المرجع البنكي",
  bank_card: "رقم العملية (اختياري)",
  cheque: "رقم الشيك",
  cash: "رقم الإيصال الورقي (اختياري)",
};

/** Dialog to record money received from a client, or a government fee paid out. */
export function PayDialog({
  title, trigger, action, accounts, defaultAmount, variant = "outline", payer = true, hint,
}: {
  title: string; trigger: string; action: (fd: FormData) => Promise<Result<unknown>>;
  accounts: Acc[]; defaultAmount?: number; variant?: "outline" | "primary" | "accent"; payer?: boolean; hint?: string;
}) {
  const [acc, setAcc] = React.useState(accounts[0]?.id ?? "");
  const [method, setMethod] = React.useState(accounts[0]?.kind === "bank" ? "bank_card" : "cash");
  const today = new Date().toISOString().slice(0, 10);
  const needsRef = method !== "cash";

  return (
    <ActionDialog
      title={title} description={hint} submitLabel="حفظ" action={action}
      trigger={<><Plus /> {trigger}</>} triggerProps={{ variant }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المبلغ">
          <Input name="amount" type="number" step="0.01" min="0.01" required defaultValue={defaultAmount && defaultAmount > 0 ? defaultAmount : ""} dir="ltr" className="text-start" inputMode="decimal" />
        </Field>
        <Field label="تاريخ الدفع">
          <DateField name="occurred_at" required defaultValue={today} max={today} />
        </Field>
        <Field label="طريقة الدفع">
          <Select name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="دخل في أي حساب؟">
          <Select name="account_id" value={acc} onChange={(e) => { setAcc(e.target.value); setMethod(accounts.find((a) => a.id === e.target.value)?.kind === "bank" ? "bank_card" : "cash"); }} required>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label={REF_LABEL[method] ?? "رقم المرجع"} hint={method === "bank_transfer" ? "الرقم الموجود في إشعار الحوالة" : undefined}>
          <Input name="reference_no" dir="ltr" className="text-start" required={method === "bank_transfer" || method === "cheque"} />
        </Field>
        {payer && needsRef && (
          <Field label="اسم المحوِّل / الدافع (اختياري)"><Input name="paid_by" /></Field>
        )}
        <Field label="ملاحظة" className="sm:col-span-2"><Input name="note" /></Field>
        <div className="sm:col-span-2"><ReceiptAttach label="إرفاق صورة الإيصال أو إشعار الحوالة (اختياري)" /></div>
      </div>
    </ActionDialog>
  );
}
