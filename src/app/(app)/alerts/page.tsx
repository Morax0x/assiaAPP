import { PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { AlertsBoard, type AlertRow } from "./alerts-board";

export const metadata = { title: "التنبيهات" };

export default async function AlertsPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const [{ data: rows }, { data: settings }, { data: types }] = await Promise.all([
    supabase.from("document_center").select("*").order("expiry_date"),
    supabase.from("office_settings").select("whatsapp_template,office_name").single(),
    supabase.from("document_types").select("id,name").order("sort_order"),
  ]);
  return (
    <>
      <PageHeader title="تنبيهات التجديد" description="المستندات التي انتهت أو ستنتهي قريباً. ابدأ بقسم «منتهي» ثم «ينتهي قريباً». بعد التجديد اضغط «رفع النسخة المجددة» وسيُغلق التنبيه تلقائياً." />
      <AlertsBoard
        rows={(rows ?? []) as AlertRow[]}
        template={settings?.whatsapp_template ?? ""}
        types={types ?? []}
        canWrite={s.perms.has("docs.write")}
        canTxn={s.perms.has("txn.write")}
      />
    </>
  );
}
