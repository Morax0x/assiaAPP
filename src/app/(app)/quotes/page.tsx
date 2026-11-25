import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { Card, Empty, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QUOTE_LABEL, QUOTE_TONE } from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { fmtDate, money } from "@/lib/utils";

export const metadata = { title: "عروض الأسعار" };

export default async function QuotesPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const { data } = await supabase.from("quotes_list").select("*").order("created_at", { ascending: false }).limit(500);
  const today = new Date().toISOString().slice(0, 10);
  const rows = (data ?? []).map((q) => ({ ...q, eff: q.status === "sent" && q.valid_until && q.valid_until < today ? "expired" : q.status }));
  return (
    <>
      <PageHeader
        title="عروض الأسعار"
        description="أنشئ عرض سعر لعميل أو لشخص جديد، أرسله، وعند موافقته حوّله إلى معاملة بضغطة واحدة."
        actions={s.perms.has("txn.write") && <Button asChild><Link href="/quotes/new"><Plus /> عرض سعر جديد</Link></Button>}
      />
      <Card>
        {rows.length === 0 ? (
          <Empty icon={<FileSpreadsheet />} title="لا توجد عروض أسعار بعد" hint="اضغط «عرض سعر جديد» وأضف الخدمات من القائمة" action={s.perms.has("txn.write") ? { href: "/quotes/new", label: "عرض سعر جديد" } : undefined} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((q) => (
              <li key={q.id}>
                <Link href={`/quotes/${q.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 hover:bg-bg">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{q.party_name}</div>
                    <div className="text-sm text-ink-3"><span className="num">{q.quote_no}</span> · <span className="num">{fmtDate(q.created_at)}</span>{q.valid_until ? <> · صالح حتى <span className="num">{fmtDate(q.valid_until)}</span></> : null}</div>
                  </div>
                  <Badge tone={QUOTE_TONE[q.eff]}>{QUOTE_LABEL[q.eff]}</Badge>
                  {q.transaction_ref && <span className="text-sm text-navy num">{q.transaction_ref}</span>}
                  <span className="w-32 text-end text-[15px] font-semibold num">{money(q.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
