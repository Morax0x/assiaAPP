import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Card, Empty, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { ExportButton } from "@/components/import-export/export-button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { PAY_STATUS_LABEL } from "@/lib/permissions";
import { fmtDate, money, waNumber } from "@/lib/utils";

export const metadata = { title: "المستحقات" };

export default async function ReceivablesPage() {
  await requirePage();
  const supabase = await createClient();
  const [{ data: rows }, { data: clients }] = await Promise.all([
    supabase.from("transactions_list").select("*").neq("status", "cancelled").gt("remaining", 0).order("created_at"),
    supabase.from("clients").select("id,phone,whatsapp"),
  ]);
  const phone = new Map<string, string | null>((clients ?? []).map((c) => [c.id as string, (c.whatsapp || c.phone) as string | null]));
  type TL = { id: string; ref_no: string; title: string; created_at: string; payment_status: string; remaining: number; client_id: string; client_name: string };
  const groups = new Map<string, { name: string; id: string; total: number; items: TL[] }>();
  ((rows ?? []) as TL[]).forEach((r) => {
    const g = groups.get(r.client_id) ?? { name: r.client_name, id: r.client_id, total: 0, items: [] };
    g.total += Number(r.remaining);
    g.items.push(r);
    groups.set(r.client_id, g);
  });
  const list = [...groups.values()].sort((a, b) => b.total - a.total);
  const grand = list.reduce((a, g) => a + g.total, 0);

  return (
    <>
      <PageHeader title="المبالغ المتبقية على العملاء" description="كل معاملة لم يدفع العميل ثمنها بالكامل، مرتبة حسب العميل. اضغط «تذكير» لإرسال رسالة واتساب جاهزة." actions={<ExportButton type="receivables" label="تصدير Excel" />} />
      <Card className="mb-4 p-4">
        <div className="text-xs text-ink-3">إجمالي المستحق لدى العملاء</div>
        <div className={`mt-1 text-2xl font-semibold ${grand > 0 ? "text-bad" : "text-ok"}`}><span className="num">{money(grand)}</span></div>
        <div className="mt-1 text-xs text-ink-3">{list.length} عميل · {rows?.length ?? 0} معاملة</div>
      </Card>
      {list.length === 0 ? (
        <Card><Empty title="لا توجد مستحقات" hint="كل المعاملات مسددة بالكامل" /></Card>
      ) : (
        <div className="space-y-3">
          {list.map((g) => {
            const wa = waNumber(phone.get(g.id));
            const msg = `السلام عليكم ${g.name}، نود تذكيركم بوجود مبلغ مستحق قدره ${money(g.total)}. نشكر لكم تعاملكم.`;
            return (
              <Card key={g.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                  <Link href={`/clients/${g.id}`} className="text-sm font-semibold hover:text-navy">{g.name}</Link>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-bad num">{money(g.total)}</span>
                    {wa && (
                      <Button asChild size="sm" variant="outline"><a href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle /> تذكير</a></Button>
                    )}
                  </div>
                </div>
                <ul className="divide-y divide-line">
                  {g.items.map((t) => (
                    <li key={t.id}>
                      <Link href={`/transactions/${t.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm hover:bg-bg">
                        <span className="min-w-0 flex-1 truncate">{t.title} <span className="text-xs text-ink-3 num">· {t.ref_no} · {fmtDate(t.created_at)}</span></span>
                        <Badge tone={STATUS_TONE[t.payment_status]}>{PAY_STATUS_LABEL[t.payment_status]}</Badge>
                        <span className="w-28 text-end num">{money(t.remaining)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
