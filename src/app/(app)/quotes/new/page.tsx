import { Card, PageHeader } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { loadTxnLookups } from "@/lib/lookups";
import { QuoteForm } from "@/components/quotes/quote-form";
import { createQuote } from "@/modules/quotes/actions";

export const metadata = { title: "عرض سعر جديد" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requirePage("txn.write");
  await requirePage("invoices.write");
  const { client } = await searchParams;
  const { clients, templates } = await loadTxnLookups();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="عرض سعر جديد" description="رقم العرض يُكتب تلقائياً عند الحفظ." back={{ href: "/quotes", label: "رجوع لعروض الأسعار" }} />
      <Card className="p-4"><QuoteForm action={createQuote} clients={clients} services={templates} initial={{ client_id: client }} submitLabel="حفظ عرض السعر" /></Card>
    </div>
  );
}
