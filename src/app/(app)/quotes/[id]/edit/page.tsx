import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadTxnLookups } from "@/lib/lookups";
import { QuoteForm } from "@/components/quotes/quote-form";
import { updateQuote } from "@/modules/quotes/actions";

export const metadata = { title: "تعديل عرض سعر" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePage("txn.write");
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotes").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!q) notFound();
  if (q.transaction_id) notFound();
  const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", id).order("position");
  const { clients, templates } = await loadTxnLookups();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`تعديل عرض السعر ${q.quote_no}`} back={{ href: `/quotes/${id}`, label: "رجوع للعرض" }} />
      <Card className="p-4">
        <QuoteForm
          action={updateQuote.bind(null, id)} clients={clients} services={templates} submitLabel="حفظ التعديلات"
          initial={{ ...q, discount: Number(q.discount) }}
          initialItems={(items ?? []).map((i) => ({ service_id: i.service_id, description: i.description, description_en: i.description_en, qty: Number(i.qty), govt_unit: Number(i.govt_unit), fee_unit: Number(i.fee_unit) }))}
        />
      </Card>
    </div>
  );
}
