import { ScrollText } from "lucide-react";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "سجل النشاط" };

const ENTITY: Record<string, string> = {
  transactions: "معاملة", ledger_entries: "حركة خزينة", documents: "مستند", clients: "عميل", share_links: "رابط مشاركة",
  reconciliations: "جرد", office_settings: "إعدادات المكتب", profiles: "مستخدم", role_permissions: "صلاحيات",
};
const ACTION: Record<string, string> = { insert: "إنشاء", update: "تعديل", delete: "حذف", soft_delete: "حذف" };

function summary(entity: string, action: string, n: Record<string, unknown> | null, o: Record<string, unknown> | null) {
  const d = (n ?? o ?? {}) as Record<string, unknown>;
  const label = (d.ref_no ?? d.title ?? d.name ?? d.full_name ?? d.description ?? "") as string;
  if (entity === "ledger_entries" && d.amount) return `${d.kind}: ${d.amount}${d.voided_at && action === "update" ? " (إلغاء)" : ""}`;
  if (entity === "transactions" && action === "update" && n && o && n.status !== o.status) return `${label}: ${o.status} ← ${n.status}`;
  return String(label);
}

export default async function AuditPage() {
  await requirePage("audit.view");
  const supabase = await createClient();
  const [{ data }, { data: users }] = await Promise.all([
    supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(200),
    supabase.from("profiles").select("id,full_name"),
  ]);
  const names = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  return (
    <Card>
      <CardHeader title="سجل النشاط (آخر 200 عملية)" />
      {!data?.length ? <Empty icon={<ScrollText />} title="لا توجد عمليات مسجلة" /> : (
        <ul className="divide-y divide-line">
          {data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <Badge tone={a.action === "insert" ? "ok" : a.action === "update" ? "navy" : "bad"}>{ACTION[a.action] ?? a.action}</Badge>
              <span className="font-medium">{ENTITY[a.entity] ?? a.entity}</span>
              <span className="min-w-0 flex-1 truncate text-ink-2">{summary(a.entity, a.action, a.new_data, a.old_data)}</span>
              <span className="text-xs text-ink-3">{a.user_id ? names.get(a.user_id) ?? "—" : "النظام"} · <span className="num">{fmtDateTime(a.at)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
