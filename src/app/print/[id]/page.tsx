import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DocumentSheet, type Lang, type SheetData } from "@/components/documents/document-sheet";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const metadata = { title: "فاتورة" };
export const dynamic = "force-dynamic";

const METHOD = {
  cash: { ar: "كاش", en: "Cash" }, bank_card: { ar: "بطاقة", en: "Card" },
  bank_transfer: { ar: "تحويل بنكي", en: "Bank Transfer" }, cheque: { ar: "شيك", en: "Cheque" },
} as Record<string, { ar: string; en: string }>;
const STATUS = {
  paid: { ar: "مدفوعة بالكامل", en: "PAID" }, partial: { ar: "مدفوعة جزئياً", en: "PARTIALLY PAID" }, unpaid: { ar: "غير مدفوعة", en: "UNPAID" },
} as Record<string, { ar: string; en: string }>;

export default async function PrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string; lang?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const kind = sp.type === "receipt" ? "receipt" : "invoice";
  const lang: Lang = sp.lang === "ar" || sp.lang === "en" ? sp.lang : "both";
  const s = await requireSession();
  const supabase = await createClient();

  // First time an invoice is opened by someone who can write, give it its official number.
  if (kind === "invoice" && s.perms.has("txn.write")) await supabase.rpc("issue_invoice", { p_txn: id });

  const [{ data: t }, { data: os }, { data: pays }, { data: items }] = await Promise.all([
    supabase.from("transactions_list").select("*").eq("id", id).maybeSingle(),
    supabase.from("office_settings").select("*").single(),
    supabase.rpc("transaction_payments", { p_txn: id }),
    supabase.from("transaction_items").select("*").eq("transaction_id", id).order("position"),
  ]);
  if (!t || !os) notFound();

  const payments = ((pays ?? []) as { amount: number; method: string; occurred_at: string; voided: boolean; reference_no: string | null }[]).filter((p) => !p.voided);
  const methods = [...new Set(payments.map((p) => p.method))].map((m) => METHOD[m]).filter(Boolean);
  const rows = (items ?? []).length
    ? (items ?? []).map((i) => ({ date: i.item_date ?? t.created_at, description: i.description, description_en: i.description_en, qty: Number(i.qty), price: Number(i.govt_unit) + Number(i.fee_unit) }))
    : [{ date: t.created_at, description: t.title, description_en: null, qty: 1, price: Number(t.govt_fees) + Number(t.office_fee) }];

  const invNo = t.invoice_no ? String(t.invoice_no) : null;
  const data: SheetData = {
    kind, lang, office: os, party: { name: t.client_name, phone: t.client_phone },
    number: kind === "receipt" ? `R-${String(t.ref_no).replace("TRX-", "")}` : invNo ?? t.ref_no,
    date: kind === "invoice" ? (t.invoice_date ?? new Date().toISOString()) : new Date().toISOString(),
    items: rows, discount: Number(t.discount), total: Number(t.total), paid: Number(t.paid), remaining: Number(t.remaining),
    paymentStatus: STATUS[t.payment_status], methods: methods.length ? { ar: methods.map((m) => m.ar).join("، "), en: methods.map((m) => m.en).join(", ") } : null,
    payments: payments.map((p) => ({ date: p.occurred_at, method: METHOD[p.method] ?? { ar: p.method, en: p.method }, ref: p.reference_no, amount: Number(p.amount) })),
    draft: kind === "invoice" && !invNo,
  };

  return (
    <div className="min-h-dvh bg-[#d9dde3] py-5 print:bg-white print:py-0">
      <style>{"@page{size:A4;margin:0}"}</style>
      <PrintToolbar lang={lang} basePath={`/print/${id}`} extra={kind === "receipt" ? "type=receipt" : ""} backHref={`/transactions/${id}`} />
      <DocumentSheet d={data} />
    </div>
  );
}
