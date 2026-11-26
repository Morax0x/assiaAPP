import Link from "next/link";
import { Plus, Printer, Receipt } from "lucide-react";
import { Card, Empty, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { PAY_STATUS_LABEL } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { fmtDate, money } from "@/lib/utils";

export const metadata = { title: "الفواتير" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requirePage();
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("transactions_list").select("id,ref_no,client_id,client_name,title,total,paid,remaining,payment_status,invoice_no,invoice_date")
    .not("invoice_no", "is", null).order("invoice_no", { ascending: false }).limit(1000);
  const t = q.trim().toLowerCase();
  const rows = (data ?? []).filter((r) => !t || String(r.invoice_no).includes(t) || (r.client_name ?? "").toLowerCase().includes(t) || (r.title ?? "").toLowerCase().includes(t));
  const owed = rows.reduce((a, r) => a + Number(r.remaining ?? 0), 0);
  return (
    <>
      <PageHeader
        title="الفواتير"
        description="كل الفواتير الصادرة. أنشئ فاتورة جديدة لأي زبون حتى لو لم يكن مسجلاً كعميل."
        actions={s.perms.has("txn.write") && <Button asChild><Link href="/invoices/new"><Plus /> فاتورة جديدة</Link></Button>}
      />
      <form className="mb-3 flex gap-2" action="/invoices">
        <input name="q" defaultValue={q} placeholder="ابحث برقم الفاتورة أو اسم الزبون" className="h-11 min-w-0 flex-1 rounded-ctl border border-line bg-surface px-3 text-[15px]" />
        <Button type="submit" variant="outline">بحث</Button>
      </form>
      {rows.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-navy-soft px-3 py-1 text-navy"><b className="num">{rows.length}</b> فاتورة</span>
          {owed > 0 && <span className="rounded-full bg-warn-soft px-3 py-1 text-warn">متبقٍ للتحصيل <b className="num">{money(owed)}</b></span>}
        </div>
      )}
      <Card>
        {rows.length === 0 ? (
          <Empty icon={<Receipt />} title={q ? "لا توجد فواتير مطابقة" : "لا توجد فواتير بعد"} hint="اضغط «فاتورة جديدة» وأدخل اسم الزبون والخدمات" action={s.perms.has("txn.write") ? { href: "/invoices/new", label: "فاتورة جديدة" } : undefined} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 hover:bg-bg">
                <Link href={`/transactions/${r.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold" dir="auto">{r.client_name}</div>
                  <div className="truncate text-sm text-ink-3"><span className="num">فاتورة {r.invoice_no}</span> · <span className="num">{fmtDate(r.invoice_date)}</span> · <span dir="auto">{r.title}</span></div>
                </Link>
                <Badge tone={STATUS_TONE[r.payment_status]}>{PAY_STATUS_LABEL[r.payment_status]}</Badge>
                <div className="w-28 text-end">
                  <div className="text-[15px] font-semibold num">{money(r.total)}</div>
                  {Number(r.remaining) > 0 && <div className="text-xs text-warn num">متبقٍ {money(r.remaining)}</div>}
                </div>
                <a href={`/print/${r.id}`} target="_blank" rel="noreferrer" className="rounded-md p-2 text-ink-2 hover:bg-mute-soft" aria-label="طباعة الفاتورة" title="طباعة / PDF"><Printer className="size-5" strokeWidth={1.75} /></a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
