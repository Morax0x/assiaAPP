import { PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { AlertsBoard, type AlertRow } from "./alerts-board";
import { RemindersPanel, type ReminderRow } from "./reminders-panel";

export const metadata = { title: "التنبيهات" };

export default async function AlertsPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const [{ data: rows }, { data: types }, { data: reminders }] = await Promise.all([
    supabase.from("document_center").select("*").order("expiry_date"),
    supabase.from("document_types").select("id,name").order("sort_order"),
    supabase.from("reminders").select("id,title,note,remind_date,done").order("done").order("remind_date"),
  ]);
  return (
    <>
      <PageHeader title="التنبيهات والتذكيرات" description="أضف تذكيراتك الخاصة بأي تاريخ، وتابع المستندات التي انتهت أو ستنتهي قريباً. بعد التجديد اضغط «رفع النسخة المجددة» وسيُغلق التنبيه تلقائياً." />
      <div className="mb-4">
        <RemindersPanel rows={(reminders ?? []) as ReminderRow[]} />
      </div>
      <AlertsBoard
        rows={(rows ?? []) as AlertRow[]}
        types={types ?? []}
        canWrite={s.perms.has("docs.write")}
        canTxn={s.perms.has("txn.write")}
      />
    </>
  );
}
