"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { ActionDialog } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { METHOD_LABEL } from "@/lib/permissions";
import type { Result } from "@/lib/action";

type Acc = { id: string; name: string; kind: string };

export function PayDialog({
  title, trigger, action, accounts, defaultAmount, variant = "outline",
}: {
  title: string; trigger: string; action: (fd: FormData) => Promise<Result<unknown>>;
  accounts: Acc[]; defaultAmount?: number; variant?: "outline" | "primary" | "accent";
}) {
  const [acc, setAcc] = React.useState(accounts[0]?.id ?? "");
  const [method, setMethod] = React.useState(accounts[0]?.kind === "bank" ? "bank_card" : "cash");
  return (
    <ActionDialog
      title={title} submitLabel="تسجيل" action={action}
      trigger={<><Plus /> {trigger}</>} triggerProps={{ variant }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المبلغ">
          <Input name="amount" type="number" step="0.01" min="0.01" required defaultValue={defaultAmount && defaultAmount > 0 ? defaultAmount : ""} dir="ltr" className="text-start" />
        </Field>
        <Field label="الحساب">
          <Select name="account_id" value={acc} onChange={(e) => { setAcc(e.target.value); setMethod(accounts.find((a) => a.id === e.target.value)?.kind === "bank" ? "bank_card" : "cash"); }} required>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="وسيلة الدفع">
          <Select name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="ملاحظة"><Input name="note" /></Field>
      </div>
    </ActionDialog>
  );
}
