import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { TransactionsTable, type TxnRow } from "./transactions-table";
import { ImportDialog } from "@/components/import-export/import-dialog";
import { ExportButton } from "@/components/import-export/export-button";

export const metadata = { title: "المعاملات" };

export default async function TransactionsPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const [{ data: rows }, { data: extra }, { data: clients }, { data: staff }] = await Promise.all([
    supabase.from("transactions_list").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("transaction_extra").select("transaction_id,service_name,method,paid_on").limit(5000),
    supabase.from("clients").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("profiles").select("id,full_name").eq("is_active", true),
  ]);
  const xmap = new Map((extra ?? []).map((x) => [x.transaction_id as string, x as { service_name: string | null; method: string | null; paid_on: string | null }]));
  return (
    <>
      <PageHeader
        title="المعاملات"
        description="كل معاملات المكتب. اضغط على أي معاملة لفتحها وتسجيل الدفعات وطباعة الفاتورة."
        actions={
          <>
            {s.perms.has("txn.write") && s.perms.has("data.import") && <ImportDialog />}
            {s.perms.has("data.export") && <ExportButton type="transactions" label="تصدير Excel" />}
            {s.perms.has("txn.write") && (
              <Button asChild><Link href="/transactions/new"><Plus /> معاملة جديدة</Link></Button>
            )}
          </>
        }
      />
      <TransactionsTable
        rows={(rows ?? []).map((r) => { const x = xmap.get(r.id as string); const hide = !s.perms.has("txn.fees"); return { ...r, govt_fees: hide ? 0 : r.govt_fees, office_fee: hide ? 0 : r.office_fee, canFees: !hide, service_name: x?.service_name ?? null, method: x?.method ?? null, paid_on: x?.paid_on ?? null } as TxnRow; })}
        clients={(clients ?? []).map((c) => ({ id: c.id, name: c.name }))}
        canFees={s.perms.has("txn.fees")}
        staff={(staff ?? []).map((p) => ({ id: p.id, name: p.full_name }))}
      />
    </>
  );
}
