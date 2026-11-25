import { Card, PageHeader } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { loadTxnLookups } from "@/lib/lookups";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { createTransactionAndGo } from "@/modules/transactions/actions";

export const metadata = { title: "معاملة جديدة" };

export default async function NewTransactionPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const s = await requirePage("txn.write");
  const { client } = await searchParams;
  const { clients, templates, staff, accounts } = await loadTxnLookups();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="معاملة جديدة" description="الرقم المرجعي يُولَّد تلقائياً عند الحفظ" />
      <Card className="p-4">
        <TransactionForm
          mode="new" action={createTransactionAndGo} submitLabel="إنشاء المعاملة"
          clients={clients} templates={templates} staff={staff} accounts={accounts}
          initial={{ client_id: client, assignee_id: s.userId }}
        />
      </Card>
    </div>
  );
}
