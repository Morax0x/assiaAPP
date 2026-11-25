import { Trash2 } from "lucide-react";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fmtDateTime } from "@/lib/utils";
import { RestoreButton } from "./restore-button";

export const metadata = { title: "سلة المحذوفات" };

export default async function TrashPage() {
  const s = await requireSession();
  const p = s.perms;
  if (!p.has("clients.delete") && !p.has("txn.delete") && !p.has("docs.delete")) redirect("/dashboard");
  const supabase = await createClient();
  const [c, t, d] = await Promise.all([
    p.has("clients.delete") ? supabase.from("clients").select("id,name,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(100) : { data: [] },
    p.has("txn.delete") ? supabase.from("transactions").select("id,ref_no,title,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(100) : { data: [] },
    p.has("docs.delete") ? supabase.from("documents").select("id,title,deleted_at").not("deleted_at", "is", null).eq("is_current", true).order("deleted_at", { ascending: false }).limit(100) : { data: [] },
  ]);
  const groups = [
    { key: "clients" as const, title: "العملاء", rows: (c.data ?? []).map((r) => ({ id: r.id as string, label: r.name as string, at: r.deleted_at as string })) },
    { key: "transactions" as const, title: "المعاملات", rows: (t.data ?? []).map((r) => ({ id: r.id as string, label: `${r.ref_no} — ${r.title}`, at: r.deleted_at as string })) },
    { key: "documents" as const, title: "المستندات", rows: (d.data ?? []).map((r) => ({ id: r.id as string, label: r.title as string, at: r.deleted_at as string })) },
  ];
  const total = groups.reduce((a, g) => a + g.rows.length, 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-3">لا يُحذف شيء نهائياً. يمكنك استرجاع أي سجل محذوف من هنا، وتبقى حركاته المالية محفوظة.</p>
      {total === 0 ? (
        <Card><Empty icon={<Trash2 />} title="السلة فارغة" /></Card>
      ) : (
        groups.filter((g) => g.rows.length).map((g) => (
          <Card key={g.key}>
            <CardHeader title={`${g.title} (${g.rows.length})`} />
            <ul className="divide-y divide-line">
              {g.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.label}</div>
                    <div className="text-xs text-ink-3">حُذف <span className="num">{fmtDateTime(r.at)}</span></div>
                  </div>
                  <RestoreButton table={g.key} id={r.id} />
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
