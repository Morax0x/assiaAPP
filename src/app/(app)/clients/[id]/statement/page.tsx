import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Empty, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { fmtDate, money } from "@/lib/utils";

export const metadata = { title: "كشف حساب عميل" };
type Row = { entry_at: string; kind: string; ref_no: string; description: string; debit: number; credit: number; balance: number };

export default async function ClientStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePage();
  const supabase = await createClient();
  const [{ data: c }, { data }] = await Promise.all([
    supabase.from("clients").select("name,phone").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.rpc("client_statement", { p_client: id }),
  ]);
  if (!c) notFound();
  const rows = (data ?? []) as Row[];
  const debit = rows.reduce((a, r) => a + Number(r.debit), 0);
  const credit = rows.reduce((a, r) => a + Number(r.credit), 0);
  return (
    <>
      <PageHeader title={`كشف حساب: ${c.name}`} description="الفواتير والدفعات والرصيد المستحق"
        actions={<><Button asChild variant="outline" className="no-print"><Link href={`/clients/${id}`}>رجوع</Link></Button><div className="no-print"><PrintButton /></div></>} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-xs text-ink-3">إجمالي الفواتير</div><div className="mt-1 font-semibold num">{money(debit)}</div></Card>
        <Card className="p-3"><div className="text-xs text-ink-3">إجمالي المدفوع</div><div className="mt-1 font-semibold text-ok num">{money(credit)}</div></Card>
        <Card className="p-3"><div className="text-xs text-ink-3">المتبقي</div><div className={`mt-1 font-semibold num ${debit - credit > 0 ? "text-bad" : "text-ok"}`}>{money(debit - credit)}</div></Card>
      </div>
      <Card>
        {!rows.length ? <Empty title="لا توجد حركات" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-line bg-bg text-xs text-ink-3">
                <tr><th className="px-3 py-2 text-start font-medium">التاريخ</th><th className="px-3 py-2 text-start font-medium">البيان</th><th className="px-3 py-2 text-end font-medium">مدين (فاتورة)</th><th className="px-3 py-2 text-end font-medium">دائن (دفعة)</th><th className="px-3 py-2 text-end font-medium">الرصيد</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 num">{fmtDate(r.entry_at)}</td>
                    <td className="px-3 py-2">{r.kind === "invoice" ? "فاتورة" : "دفعة"} · <span className="num">{r.ref_no}</span> <span className="text-ink-3">{r.description}</span></td>
                    <td className="px-3 py-2 text-end num">{Number(r.debit) ? money(r.debit, "") : ""}</td>
                    <td className="px-3 py-2 text-end text-ok num">{Number(r.credit) ? money(r.credit, "") : ""}</td>
                    <td className="px-3 py-2 text-end font-medium num">{money(r.balance, "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
