import { Card } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, Textarea } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { ExportButton } from "@/components/import-export/export-button";
import { updateOffice } from "@/modules/settings/actions";

export const metadata = { title: "إعدادات المكتب" };

export default async function GeneralSettings() {
  const s = await requirePage("settings.manage");
  const supabase = await createClient();
  const { data: o } = await supabase.from("office_settings").select("*").single();
  return (
    <div className="space-y-4">
    <Card className="p-4">
      <ActionForm action={updateOffice} resetOnSuccess={false}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم المكتب (يظهر في الفواتير)"><Input name="office_name" defaultValue={o?.office_name} required /></Field>
          <Field label="هاتف المكتب"><Input name="phone" defaultValue={o?.phone ?? ""} dir="ltr" className="text-start" /></Field>
          <Field label="العنوان" className="sm:col-span-2"><Input name="address" defaultValue={o?.address ?? ""} /></Field>
          <Field label="البريد الإلكتروني"><Input name="email" defaultValue={o?.email ?? ""} dir="ltr" className="text-start" /></Field>
          <Field label="الموقع الإلكتروني"><Input name="website" defaultValue={o?.website ?? ""} dir="ltr" className="text-start" placeholder="assia.ae" /></Field>
          <Field label="الرقم الضريبي (اختياري)"><Input name="tax_number" defaultValue={o?.tax_number ?? ""} dir="ltr" className="text-start" /></Field>
          <Field label="رقم الفاتورة القادمة" hint="الفاتورة التالية التي تُصدر تأخذ هذا الرقم، ثم يزيد تلقائياً"><Input name="next_invoice_no" type="number" min="1" defaultValue={o?.next_invoice_no ?? 11110} dir="ltr" className="text-start" required /></Field>
          <div className="sm:col-span-2 rounded-card border border-line p-3">
            <div className="mb-2 text-sm font-semibold">بيانات التحويل البنكي (تظهر في الفاتورة إن بقي مبلغ غير مسدد)</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="اسم البنك"><Input name="bank_name" defaultValue={o?.bank_name ?? ""} dir="ltr" className="text-start" placeholder="Abu Dhabi Islamic Bank" /></Field>
              <Field label="اسم الحساب"><Input name="bank_account_name" defaultValue={o?.bank_account_name ?? ""} dir="ltr" className="text-start" /></Field>
              <Field label="رقم الآيبان IBAN"><Input name="iban" defaultValue={o?.iban ?? ""} dir="ltr" className="text-start" /></Field>
              <Field label="رقم الحساب"><Input name="bank_account_no" defaultValue={o?.bank_account_no ?? ""} dir="ltr" className="text-start" /></Field>
            </div>
          </div>
          <Field label="تذييل الفاتورة"><Input name="invoice_footer" defaultValue={o?.invoice_footer ?? ""} placeholder="شكراً لتعاملكم معنا" /></Field>
          <Field label="شروط عرض السعر (تظهر أسفل عرض السعر)" className="sm:col-span-2">
            <Textarea name="quote_terms" defaultValue={o?.quote_terms ?? ""} placeholder="مثال: الأسعار قابلة للتغيير حسب رسوم الجهات الحكومية، ويُبدأ العمل بعد استلام الدفعة المقدمة." />
          </Field>
          <Field label="رسالة واتساب للتجديد" hint="المتغيرات: {client} اسم العميل، {document} المستند، {date} تاريخ الانتهاء" className="sm:col-span-2">
            <Textarea name="whatsapp_template" defaultValue={o?.whatsapp_template} className="min-h-24" required />
          </Field>
        </div>
        <p className="text-xs text-ink-3">العملة: درهم إماراتي (AED)</p>
      </ActionForm>
    </Card>
    {s.profile.role === "owner" && (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div><div className="text-sm font-semibold">نسخة احتياطية</div><div className="text-xs text-ink-3">ملف Excel يحوي كل بياناتك (العملاء، المعاملات، الخزينة، المستندات). يُنصح بتحميله أسبوعياً.</div></div>
        <ExportButton type="backup" label="تحميل نسخة احتياطية" />
      </Card>
    )}
    </div>
  );
}
