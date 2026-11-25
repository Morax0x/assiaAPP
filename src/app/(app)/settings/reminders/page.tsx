import { Card, CardHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { updateReminders } from "@/modules/settings/actions";

export const metadata = { title: "إعدادات التذكير" };

export default async function RemindersSettings() {
  await requirePage("settings.manage");
  const supabase = await createClient();
  const [{ data: o }, { data: types }] = await Promise.all([
    supabase.from("office_settings").select("default_reminder_days,critical_days").single(),
    supabase.from("document_types").select("id,name,reminder_days").order("sort_order"),
  ]);
  return (
    <Card>
      <CardHeader title="فترات التذكير (بالأيام قبل الانتهاء)" />
      <div className="p-4">
        <ActionForm action={updateReminders} resetOnSuccess={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="الفترات الافتراضية" hint="افصل بفاصلة. مثال: 90, 60, 30, 14, 7">
              <Input name="default_days" defaultValue={(o?.default_reminder_days ?? []).join(", ")} dir="ltr" className="text-start" />
            </Field>
            <Field label="حد «ينتهي قريباً (حرج)» بالأيام">
              <Input name="critical_days" type="number" min="1" max="180" defaultValue={o?.critical_days ?? 14} dir="ltr" className="text-start" />
            </Field>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">قاعدة مخصصة لكل نوع مستند</h3>
            <p className="mb-3 text-xs text-ink-3">اترك الحقل فارغاً لاستخدام الفترات الافتراضية.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(types ?? []).map((t) => (
                <Field key={t.id} label={t.name}>
                  <Input name={`type_${t.id}`} defaultValue={(t.reminder_days ?? []).join(", ")} placeholder="الافتراضي" dir="ltr" className="text-start" />
                </Field>
              ))}
            </div>
          </div>
        </ActionForm>
      </div>
    </Card>
  );
}
