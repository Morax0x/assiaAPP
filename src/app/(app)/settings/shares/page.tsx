import { Link2 } from "lucide-react";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { revokeShareLink } from "@/modules/share/actions";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "روابط المشاركة" };
const SCOPE = { transaction: "معاملة", client_folder: "ملف عميل", documents: "مستندات محددة" } as const;

export default async function SharesSettings() {
  await requirePage("share.create");
  const supabase = await createClient();
  const { data } = await supabase
    .from("share_links")
    .select("id,scope,expires_at,revoked_at,view_count,last_viewed_at,pin_hash,created_at,clients(name),transactions(ref_no)")
    .order("created_at", { ascending: false }).limit(100);
  const now = Date.now();
  return (
    <Card>
      <CardHeader title="روابط المشاركة الخارجية" />
      {!data?.length ? <Empty icon={<Link2 />} title="لا توجد روابط" hint="أنشئ رابطاً من صفحة العميل أو المعاملة" /> : (
        <ul className="divide-y divide-line">
          {data.map((l) => {
            const x = l as unknown as { clients: { name: string } | null; transactions: { ref_no: string } | null };
            const expired = new Date(l.expires_at).getTime() < now;
            const active = !l.revoked_at && !expired;
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{SCOPE[l.scope as keyof typeof SCOPE]}{x.transactions ? ` · ${x.transactions.ref_no}` : ""}{x.clients ? ` · ${x.clients.name}` : ""}</div>
                  <div className="text-xs text-ink-3">ينتهي <span className="num">{fmtDateTime(l.expires_at)}</span> · {l.view_count} مشاهدة{l.pin_hash ? " · محمي برمز" : ""}</div>
                </div>
                <Badge tone={l.revoked_at ? "mute" : expired ? "bad" : "ok"}>{l.revoked_at ? "ملغى" : expired ? "منتهي" : "فعّال"}</Badge>
                {active && (
                  <ConfirmButton size="sm" variant="danger" title="إلغاء الرابط" message="سيتوقف الرابط عن العمل فوراً لكل من يملكه." action={revokeShareLink.bind(null, l.id)} confirmLabel="إلغاء الرابط">إلغاء</ConfirmButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
