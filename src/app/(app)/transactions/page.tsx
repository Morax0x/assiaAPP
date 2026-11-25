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
  const [{ data: rows }, { data: clients }, { data: staff }] = await Promise.all([
    supabase.from("transactions_list").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("clients").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("profiles").select("id,full_name").eq("is_active", true),
  ]);
  return (
    <>
      <PageHeader
        title="المعاملات"
        description="كل معاملات المكتب. اضغط على أي معاملة لفتحها وتسجيل الدفعات وطباعة الفاتورة."
        actions={
          <>
            {s.perms.has("txn.write") && <ImportDialog />}
            <ExportButton type="transactions" label="تصدير Excel" />
            {s.perms.has("txn.write") && (
              <Button asChild><Link href="/transactions/new"><Plus /> معاملة جديدة</Link></Button>
            )}
          </>
        }
      />
      <TransactionsTable
        rows={(rows ?? []) as TxnRow[]}
        clients={(clients ?? []).map((c) => ({ id: c.id, name: c.name }))}
        staff={(staff ?? []).map((p) => ({ id: p.id, name: p.full_name }))}
      />
    </>
  );
}
