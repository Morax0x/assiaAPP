import Link from "next/link";
import { Banknote, CreditCard, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { ExpenseDialog, ReconcileDialog, TransferDialog } from "@/components/treasury/treasury-dialogs";
import { LedgerList, type LedgerRow } from "./ledger-list";
import { ExportButton } from "@/components/import-export/export-button";
import { fmtDateTime, money } from "@/lib/utils";

export const metadata = { title: "الخزينة" };

export default async function TreasuryPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const s = await requirePage("treasury.view");
  const { new: neu } = await searchParams;
  const supabase = await createClient();
  const [{ data: bal }, { data: cats }, { data: entries }, { data: recs }] = await Promise.all([
    supabase.from("account_balances").select("*").order("kind"),
    supabase.from("expense_categories").select("id,name").eq("is_active", true).order("name"),
    supabase.from("ledger_entries")
      .select("id,account_id,direction,kind,amount,method,occurred_at,description,receipt_path,voided_at,reference_no,paid_by,accounts(name),expense_categories(name),transactions(id,ref_no,title),clients(id,name),profiles(full_name)")
      .order("occurred_at", { ascending: false }).limit(500),
    supabase.from("reconciliations").select("id,system_balance,actual_balance,difference,reconciled_at,note,accounts(name),profiles(full_name)").order("reconciled_at", { ascending: false }).limit(30),
  ]);
  const accounts = (bal ?? []).map((b) => ({ id: b.account_id as string, name: b.name as string, kind: b.kind as string, balance: Number(b.balance) }));
  const canWrite = s.perms.has("treasury.write");
  const ICON = { cash: Banknote, bank: CreditCard, other: Landmark } as const;

  return (
    <>
      <PageHeader
        title="الصندوق والبطاقة"
        description="رصيد الكاش والبطاقة وكل الحركات. الأرصدة تُحسب تلقائياً من الدفعات والمصاريف."
        actions={
          <>
            {canWrite && <ExpenseDialog accounts={accounts} categories={cats ?? []} defaultOpen={neu === "expense"} />}
            {canWrite && accounts.length > 1 && <TransferDialog accounts={accounts} />}
            {canWrite && <ReconcileDialog accounts={accounts} />}
            <Button asChild variant="outline"><Link href="/treasury/statement">كشف حساب</Link></Button>
            <ExportButton type="ledger" label="تصدير الحركات" />
          </>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => {
          const Icon = ICON[a.kind as keyof typeof ICON] ?? Landmark;
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-center gap-2 text-sm text-ink-2"><Icon className="size-4 text-navy" strokeWidth={1.75} />{a.name}</div>
              <div className={`mt-2 text-2xl font-semibold ${a.balance < 0 ? "text-bad" : ""}`}><span className="num">{money(a.balance)}</span></div>
            </Card>
          );
        })}
      </div>
      <LedgerList rows={(entries ?? []) as unknown as LedgerRow[]} accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} canWrite={canWrite} />
      <Card className="mt-5">
        <div className="border-b border-line px-4 py-3 text-base font-semibold">سجل جرد الصندوق</div>
        {!(recs?.length) ? (
          <p className="px-4 py-8 text-center text-sm text-ink-3">لم يُجرَ أي جرد بعد. اضغط «جرد الصندوق» لعدّ الفلوس ومطابقتها مع النظام.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line bg-bg text-xs text-ink-3">
                <tr>
                  <th className="px-3 py-2.5 text-start font-medium">التاريخ</th><th className="px-3 py-2.5 text-start font-medium">الحساب</th>
                  <th className="px-3 py-2.5 text-end font-medium">في النظام</th><th className="px-3 py-2.5 text-end font-medium">الفعلي</th>
                  <th className="px-3 py-2.5 text-end font-medium">الفرق</th><th className="px-3 py-2.5 text-start font-medium">أجراه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(recs ?? []).map((r) => {
                  const x = r as unknown as { accounts: { name: string } | null; profiles: { full_name: string } | null };
                  const d = Number(r.difference);
                  return (
                    <tr key={r.id}>
                      <td className="px-3 py-3 num">{fmtDateTime(r.reconciled_at)}</td>
                      <td className="px-3 py-3">{x.accounts?.name}</td>
                      <td className="px-3 py-3 text-end num">{money(r.system_balance, "")}</td>
                      <td className="px-3 py-3 text-end num">{money(r.actual_balance, "")}</td>
                      <td className={`px-3 py-3 text-end font-semibold num ${d === 0 ? "text-ok" : "text-warn"}`}>{d === 0 ? "مطابق" : (d > 0 ? "+" : "") + money(d, "")}</td>
                      <td className="px-3 py-3">{x.profiles?.full_name ?? "—"}{r.note ? <span className="text-ink-3"> · {r.note}</span> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
