import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DocumentSheet, type Lang, type SheetData } from "@/components/documents/document-sheet";
import { PrintToolbar } from "@/components/documents/print-toolbar";

export const metadata = { title: "عرض سعر" };
export const dynamic = "force-dynamic";

export default async function PrintQuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireSession();
  const supabase = await createClient();
  const [{ data: q }, { data: items }, { data: os }, { data: full }] = await Promise.all([
    supabase.from("quotes_list").select("*").eq("id", id).maybeSingle(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
    supabase.from("office_settings").select("*").single(),
    supabase.from("quotes").select("notes").eq("id", id).maybeSingle(),
  ]);
  if (!q || !os) notFound();
  const lang: Lang = sp.lang === "ar" || sp.lang === "en" || sp.lang === "both" ? sp.lang : (q.lang as Lang);
  const data: SheetData = {
    kind: "quote", lang, office: os, party: { name: q.party_name, phone: q.party_phone },
    number: q.quote_no, date: q.created_at, validUntil: q.valid_until,
    items: (items ?? []).map((i) => ({ date: q.created_at, description: i.description, description_en: i.description_en, qty: Number(i.qty), price: Number(i.govt_unit) + Number(i.fee_unit) })),
    discount: Number(q.discount), total: Number(q.total), notes: full?.notes ?? null,
  };
  return (
    <div className="min-h-dvh bg-[#d9dde3] py-5 print:bg-white print:py-0">
      <style>{"@page{size:A4;margin:0}"}</style>
      <PrintToolbar lang={lang} basePath={`/print/quote/${id}`} backHref={`/quotes/${id}`} />
      <DocumentSheet d={data} />
    </div>
  );
}
