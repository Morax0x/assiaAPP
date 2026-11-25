import { Pencil, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ActionDialog } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { saveAccount, saveCategory } from "@/modules/treasury/actions";
import { money } from "@/lib/utils";

export const metadata = { title: "الحسابات والمصاريف" };
const KIND = { cash: "كاش", bank: "بنك / بطاقة", other: "أخرى" } as const;

export default async function AccountsSettings() {
  await requirePage("settings.manage");
  const supabase = await createClient();
  const [{ data: accounts }, { data: cats }] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("expense_categories").select("*").order("name"),
  ]);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="حسابات الخزينة"
          action={
            <ActionDialog title="حساب جديد" description="يمكن إضافة بطاقات أو حسابات بنكية أخرى" trigger={<><Plus /> حساب</>} triggerProps={{ size: "sm", variant: "primary" }} action={saveAccount}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="اسم الحساب"><Input name="name" required /></Field>
                <Field label="النوع"><Select name="kind" defaultValue="bank"><option value="cash">كاش</option><option value="bank">بنك / بطاقة</option><option value="other">أخرى</option></Select></Field>
                <Field label="الرصيد الافتتاحي" hint="لا يمكن تعديله لاحقاً، استخدم الجرد للتسوية" className="sm:col-span-2"><Input name="opening_balance" type="number" step="0.01" defaultValue="0" dir="ltr" className="text-start" /></Field>
              </div>
            </ActionDialog>
          }
        />
        <ul className="divide-y divide-line">
          {(accounts ?? []).map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="flex-1 font-medium">{a.name}</span>
              <Badge tone="navy">{KIND[a.kind as keyof typeof KIND]}</Badge>
              <span className="text-xs text-ink-3">افتتاحي <span className="num">{money(a.opening_balance)}</span></span>
              <ActionDialog title="تعديل الحساب" trigger={<Pencil />} triggerProps={{ size: "icon", variant: "ghost" }} action={saveAccount}>
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="kind" value={a.kind} />
                <Field label="اسم الحساب"><Input name="name" defaultValue={a.name} required /></Field>
              </ActionDialog>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="بنود المصاريف التشغيلية"
          action={
            <ActionDialog title="بند جديد" trigger={<><Plus /> بند</>} triggerProps={{ size: "sm", variant: "primary" }} action={saveCategory}>
              <Field label="اسم البند"><Input name="name" required /></Field>
            </ActionDialog>
          }
        />
        <div className="flex flex-wrap gap-2 p-4">
          {(cats ?? []).map((c) => <Badge key={c.id} tone="mute" className="px-3 py-1 text-[13px]">{c.name}</Badge>)}
        </div>
      </Card>
    </div>
  );
}
