import { Card, PageHeader } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { loadTxnLookups } from "@/lib/lookups";
import { QuoteForm } from "@/components/quotes/quote-form";
import { createInvoice } from "@/modules/quotes/actions";

export const metadata = { title: "فاتورة جديدة" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requirePage("txn.write");
  const { client } = await searchParams;
  const { clients, templates } = await loadTxnLookups();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="فاتورة جديدة" description="اكتب اسم الزبون أو اختر عميلاً مسجلاً، أضف الخدمات، ثم احفظ لتظهر الفاتورة جاهزة للطباعة." back={{ href: "/invoices", label: "رجوع للفواتير" }} />
      <Card className="p-4"><QuoteForm mode="invoice" action={createInvoice} clients={clients} services={templates} initial={{ client_id: client }} submitLabel="إصدار الفاتورة" /></Card>
    </div>
  );
}
