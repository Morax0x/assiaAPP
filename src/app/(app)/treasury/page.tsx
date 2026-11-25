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
      .select("id,account_id,direction,kind,amount,method,occurred_at,description,receipt_path,voided_at,accounts(name),expense_categories(name),transactions(ref_no,title)")
      .order("occurred_at", { ascending: false }).limit(500),
    supabase.from("reconciliations").select("id,system_balance,actual_balance,difference,reconciled_at,note,accounts(name)").order("reconciled_at", { ascending: false }).limit(5),
  ]);
  const accounts = (bal ?? []).map((b) => ({ id: b.account_id as string, name: b.name as string, kind: b.kind as string, balance: Number(b.balance) }));
  const canWrite = s.perms.has("treasury.write");
  const ICON = { cash: Banknote, bank: CreditCard, other: Landmark } as const;

  return (
    <>
      <PageHeader
        title="الخزينة والمالية"
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
      {(recs?.length ?? 0) > 0 && (
        <Card className="mt-5">
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">آخر عمليات الجرد</div>
          <ul className="divide-y divide-line text-sm">
            {(recs ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span>{(r as unknown as { accounts: { name: string } | null }).accounts?.name} <span className="text-xs text-ink-3 num">· {fmtDateTime(r.reconciled_at)}</span></span>
                <span className={Number(r.difference) === 0 ? "text-ok" : "text-warn"}>
                  {Number(r.difference) === 0 ? "مطابق" : <>فرق <span className="num">{money(r.difference)}</span></>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
