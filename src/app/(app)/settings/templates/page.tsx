import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { ActionDialog } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Field, Input } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { deleteTemplate, saveTemplate } from "@/modules/settings/actions";
import { money } from "@/lib/utils";

export const metadata = { title: "قوالب الخدمات" };

function Fields({ t }: { t?: { id: string; name: string; default_govt_fee: number; default_office_fee: number } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {t && <input type="hidden" name="id" value={t.id} />}
      <Field label="اسم الخدمة" className="sm:col-span-2"><Input name="name" defaultValue={t?.name} required /></Field>
      <Field label="الرسوم الحكومية الافتراضية"><Input name="default_govt_fee" type="number" step="0.01" min="0" defaultValue={t?.default_govt_fee ?? 0} dir="ltr" className="text-start" /></Field>
      <Field label="أتعاب المكتب الافتراضية"><Input name="default_office_fee" type="number" step="0.01" min="0" defaultValue={t?.default_office_fee ?? 0} dir="ltr" className="text-start" /></Field>
    </div>
  );
}

export default async function TemplatesSettings() {
  await requirePage("settings.manage");
  const supabase = await createClient();
  const { data } = await supabase.from("service_templates").select("*").eq("is_active", true).order("name");
  return (
    <Card>
      <CardHeader
        title={`قائمة الخدمات والأسعار (${data?.length ?? 0})`}
        action={<ActionDialog title="خدمة جديدة" trigger={<><Plus /> إضافة خدمة</>} triggerProps={{ size: "sm", variant: "primary" }} action={saveTemplate}><Fields /></ActionDialog>}
      />
      {!data?.length ? <Empty title="لا توجد قوالب" hint="أضف الخدمات المتكررة لتعبئة المعاملات خلال ثوانٍ" /> : (
        <ul className="divide-y divide-line">
          {data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{t.name}</div>
                <div className="text-xs text-ink-3">رسوم <span className="num">{money(t.default_govt_fee)}</span> · أتعاب <span className="num">{money(t.default_office_fee)}</span></div>
              </div>
              <ActionDialog title="تعديل القالب" trigger={<Pencil />} triggerProps={{ size: "icon", variant: "ghost" }} action={saveTemplate}>
                <Fields t={{ id: t.id, name: t.name, default_govt_fee: Number(t.default_govt_fee), default_office_fee: Number(t.default_office_fee) }} />
              </ActionDialog>
              <ConfirmButton size="icon" variant="ghost" title="حذف القالب" message="لن يظهر القالب في المعاملات الجديدة. المعاملات السابقة لا تتأثر." action={deleteTemplate.bind(null, t.id)} confirmLabel="حذف">
                    <Trash2 className="text-bad" />
                  </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
