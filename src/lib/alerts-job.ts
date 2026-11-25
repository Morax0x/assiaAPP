import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToOwner } from "@/lib/push";

/**
 * Daily job: for every current document, find the smallest reminder threshold the
 * remaining days have crossed; if that (document, threshold) hasn't been sent yet,
 * push to the owner. Idempotent via alert_dispatches. Expired docs use threshold 0.
 */
export async function runAlertsJob() {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: docs }, { data: os }, { data: types }, { data: sent }] = await Promise.all([
    admin.from("documents")
      .select("id,title,expiry_date,type_id,followup,snoozed_until,clients(name)")
      .eq("is_current", true).is("deleted_at", null).not("expiry_date", "is", null),
    admin.from("office_settings").select("default_reminder_days").single(),
    admin.from("document_types").select("id,name,reminder_days"),
    admin.from("alert_dispatches").select("document_id,threshold"),
  ]);
  const defaults: number[] = os?.default_reminder_days ?? [90, 60, 30, 14, 7];
  const typeMap = new Map((types ?? []).map((t) => [t.id, t]));
  const done = new Set((sent ?? []).map((s) => `${s.document_id}:${s.threshold}`));

  const due: { id: string; threshold: number; days: number; client: string; label: string }[] = [];
  for (const d of docs ?? []) {
    if (d.followup === "done" || d.followup === "renewal_started") continue;
    if (d.snoozed_until && d.snoozed_until > today) continue;
    const days = Math.ceil((new Date(d.expiry_date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
    const t = typeMap.get(d.type_id);
    const list = [...((t?.reminder_days as number[] | null) ?? defaults)].sort((a, b) => a - b);
    let threshold: number | null = null;
    if (days < 0) threshold = 0;
    else threshold = list.find((x) => days <= x) ?? null;
    if (threshold === null || done.has(`${d.id}:${threshold}`)) continue;
    due.push({ id: d.id, threshold, days, client: (d as unknown as { clients: { name: string } | null }).clients?.name ?? "", label: `${t?.name ?? "مستند"}` });
  }
  if (!due.length) return { sent: 0, docs: 0 };

  // Group into one notification to avoid spam; list the most urgent first.
  due.sort((a, b) => a.days - b.days);
  const top = due.slice(0, 3).map((x) => `${x.client}: ${x.label} (${x.days < 0 ? `متأخر ${-x.days} يوم` : x.days === 0 ? "ينتهي اليوم" : `${x.days} يوم`})`);
  const more = due.length > 3 ? ` و${due.length - 3} أخرى` : "";
  const delivered = await pushToOwner({
    title: `${due.length} مستند يحتاج متابعة`,
    body: top.join("\n") + more,
    url: "/alerts",
    tag: "doc-alerts",
  });
  // Mark as dispatched even with zero devices registered? No: only when delivered, so enabling push later still alerts.
  if (delivered > 0) {
    await admin.from("alert_dispatches").upsert(due.map((x) => ({ document_id: x.id, threshold: x.threshold })), { onConflict: "document_id,threshold" });
  }
  return { sent: delivered, docs: due.length };
}
