import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTxnLookups } from "@/lib/lookups";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { updateTransaction } from "@/modules/transactions/actions";

export const metadata = { title: "تعديل معاملة" };

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePage("txn.write");
  const supabase = await createClient();
  const { data: t } = await supabase.from("transactions").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!t) notFound();
  const { clients, templates, staff } = await loadTxnLookups();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`تعديل المعاملة ${t.ref_no}`} back={{ href: `/transactions/${id}`, label: "رجوع للمعاملة" }} />
      <Card className="p-4">
        <TransactionForm
          mode="edit" action={updateTransaction.bind(null, id)} submitLabel="حفظ التعديلات"
          clients={clients} templates={templates} staff={staff}
          initial={{ ...t, govt_fees: Number(t.govt_fees), office_fee: Number(t.office_fee), discount: Number(t.discount) }}
        />
      </Card>
    </div>
  );
}
