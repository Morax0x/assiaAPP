import Link from "next/link";
import { Card, Empty, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { LEDGER_KIND_LABEL } from "@/lib/permissions";
import { fmtDate, money } from "@/lib/utils";
import { RangePicker } from "../../reports/range-picker";
import { StatementAccountSelect } from "./account-select";

export const metadata = { title: "كشف حساب الخزينة" };
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Row = { entry_at: string; kind: string | null; direction: string | null; amount: number; description: string | null; txn_ref: string | null; balance: number; is_opening: boolean };

export default async function StatementPage({ searchParams }: { searchParams: Promise<{ account?: string; from?: string; to?: string }> }) {
  await requirePage("treasury.view");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: accounts } = await supabase.from("accounts").select("id,name").order("created_at");
  const account = sp.account ?? accounts?.[0]?.id ?? "";
  const now = new Date();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : iso(now);
  const { data } = account ? await supabase.rpc("account_statement", { p_account: account, p_from: from, p_to: to }) : { data: [] };
  const rows = (data ?? []) as Row[];
  const opening = rows.find((r) => r.is_opening);
  const moves = rows.filter((r) => !r.is_opening);
  const tin = moves.filter((r) => r.direction === "in").reduce((a, r) => a + Number(r.amount), 0);
  const tout = moves.filter((r) => r.direction === "out").reduce((a, r) => a + Number(r.amount), 0);
  const closing = moves.length ? Number(moves[moves.length - 1].balance) : Number(opening?.balance ?? 0);
  const name = accounts?.find((a) => a.id === account)?.name ?? "";

  return (
    <>
      <PageHeader title={`كشف حساب: ${name}`} description={`من ${fmtDate(from)} إلى ${fmtDate(to)}`}
        actions={<><Button asChild variant="outline"><Link href="/treasury">رجوع للخزينة</Link></Button></>} />
      <div className="no-print">
        <StatementAccountSelect accounts={accounts ?? []} account={account} from={from} to={to} />
        <RangePicker from={from} to={to} basePath="/treasury/statement" extra={{ account }} />
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-3"><div className="text-xs text-ink-3">رصيد أول المدة</div><div className="mt-1 font-semibold num">{money(opening?.balance)}</div></Card>
        <Card className="p-3"><div className="text-xs text-ink-3">وارد / صادر</div><div className="mt-1 text-sm font-semibold"><span className="text-ok num">{money(tin)}</span> / <span className="text-bad num">{money(tout)}</span></div></Card>
        <Card className="p-3"><div className="text-xs text-ink-3">رصيد آخر المدة</div><div className="mt-1 font-semibold num">{money(closing)}</div></Card>
      </div>
      <Card>
        {!moves.length ? <Empty title="لا توجد حركات في هذه الفترة" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-line bg-bg text-xs text-ink-3">
                <tr><th className="px-3 py-2 text-start font-medium">التاريخ</th><th className="px-3 py-2 text-start font-medium">البيان</th><th className="px-3 py-2 text-end font-medium">وارد</th><th className="px-3 py-2 text-end font-medium">صادر</th><th className="px-3 py-2 text-end font-medium">الرصيد</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {moves.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 num">{fmtDate(r.entry_at)}</td>
                    <td className="px-3 py-2">{LEDGER_KIND_LABEL[r.kind ?? ""] ?? ""}{r.txn_ref ? ` · ${r.txn_ref}` : ""}{r.description ? <span className="text-ink-3"> · {r.description}</span> : null}</td>
                    <td className="px-3 py-2 text-end text-ok num">{r.direction === "in" ? money(r.amount, "") : ""}</td>
                    <td className="px-3 py-2 text-end text-bad num">{r.direction === "out" ? money(r.amount, "") : ""}</td>
                    <td className="px-3 py-2 text-end font-medium num">{money(r.balance, "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="no-print mt-3 flex justify-end"><PrintButton /></div>
    </>
  );
}
