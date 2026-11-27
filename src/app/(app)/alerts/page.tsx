import { PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { AlertsBoard, type AlertRow } from "./alerts-board";
import { RemindersPanel, type ReminderRow } from "./reminders-panel";

export const metadata = { title: "التنبيهات" };

export default async function AlertsPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const [{ data: baseRows }, { data: types }, { data: reminders }, { data: folders }, { data: clients }] = await Promise.all([
    supabase.from("document_center").select("*").order("expiry_date"),
    supabase.from("document_types").select("id,name").order("sort_order"),
    supabase.from("reminders").select("id,title,note,remind_date,done").order("done").order("remind_date"),
    supabase.from("documents").select("id,folder").eq("is_current", true).is("deleted_at", null).not("expiry_date", "is", null),
    supabase.from("clients").select("id,name,parent_id"),
  ]);
  // Whose document it is: the innermost folder's name if it sits in a sub-folder, else the client (employee) itself; the company is only a hint.
  const folderOf = new Map((folders ?? []).map((f) => [f.id as string, (f.folder as string | null) ?? ""]));
  const clientOf = new Map((clients ?? []).map((c) => [c.id as string, c as { id: string; name: string; parent_id: string | null }]));
  const rows = (baseRows ?? []).map((r) => {
    const segs = (folderOf.get(r.id as string) ?? "").split("/").map((x) => x.trim()).filter(Boolean);
    const c = clientOf.get(r.client_id as string);
    const parent = c?.parent_id ? clientOf.get(c.parent_id)?.name : null;
    const owner = segs.length ? segs[segs.length - 1] : (r.client_name as string);
    const hint = [parent, segs.length ? r.client_name : null].filter(Boolean).join(" › ");
    return { ...r, owner_name: owner, owner_hint: hint };
  });
  return (
    <>
      <PageHeader title="التنبيهات والتذكيرات" description="أضف تذكيراتك الخاصة بأي تاريخ، وتابع المستندات التي انتهت أو ستنتهي قريباً. بعد التجديد اضغط «رفع النسخة المجددة» وسيُغلق التنبيه تلقائياً." />
      <div className="mb-4">
        <RemindersPanel rows={(reminders ?? []) as ReminderRow[]} />
      </div>
      <AlertsBoard
        rows={rows as unknown as AlertRow[]}
        types={types ?? []}
        canWrite={s.perms.has("docs.write")}
        canTxn={s.perms.has("txn.write")}
      />
    </>
  );
}
