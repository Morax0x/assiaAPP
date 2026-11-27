import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, Pencil, Printer, Trash2 } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { convertQuoteAction, deleteQuote } from "@/modules/quotes/actions";
import { fmtDate, money } from "@/lib/utils";
import { QUOTE_LABEL, QUOTE_TONE } from "@/lib/quotes";
import { QuoteStatusButtons } from "./status-buttons";

export const metadata = { title: "عرض السعر" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePage();
  const supabase = await createClient();
  const [{ data: q }, { data: items }, { data: full }] = await Promise.all([
    supabase.from("quotes_list").select("*").eq("id", id).maybeSingle(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
    supabase.from("quotes").select("notes,internal_notes").eq("id", id).maybeSingle(),
  ]);
  if (!q) notFound();
  const canWrite = s.perms.has("txn.write");
  const converted = !!q.transaction_id;
  const today = new Date().toISOString().slice(0, 10);
  const eff = q.status === "sent" && q.valid_until && q.valid_until < today ? "expired" : q.status;

  return (
    <>
      <PageHeader
        back={{ href: "/quotes", label: "رجوع لعروض الأسعار" }}
        title={`عرض سعر: ${q.party_name}`}
        description={`رقم العرض ${q.quote_no} · ${fmtDate(q.created_at)}`}
        actions={
          <>
            <Button asChild variant="outline"><a href={`/print/quote/${id}`} target="_blank" rel="noreferrer"><Printer /> طباعة / PDF</a></Button>
            {canWrite && !converted && <Button asChild variant="outline"><Link href={`/quotes/${id}/edit`}><Pencil /> تعديل</Link></Button>}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="الحالة" action={<Badge tone={QUOTE_TONE[eff]}>{QUOTE_LABEL[eff]}</Badge>} />
            <div className="space-y-3 p-4">
              {converted ? (
                <p className="text-[15px] text-ok">تم تحويل هذا العرض إلى المعاملة <Link href={`/transactions/${q.transaction_id}`} className="font-semibold underline num">{q.transaction_ref}</Link>.</p>
              ) : canWrite ? (
                <>
                  <p className="text-sm text-ink-3">بعد موافقة العميل اضغط الزر الكبير لإنشاء المعاملة بنفس البنود والأسعار، ثم يمكنك إصدار الفاتورة منها.</p>
                  <ConfirmButton size="lg" variant="accent" title="تحويل إلى معاملة" message="سيُنشأ معاملة جديدة بنفس بنود وأسعار هذا العرض، وإن كان العميل جديداً فسيُضاف إلى العملاء." action={convertQuoteAction.bind(null, id)} confirmLabel="تحويل">
                    <ArrowLeftRight /> وافق العميل، حوّل إلى معاملة
                  </ConfirmButton>
                  <QuoteStatusButtons id={id} status={q.status} />
                </>
              ) : null}
            </div>
          </Card>
          <Card>
            <CardHeader title="بنود العرض" />
            <ul className="divide-y divide-line">
              {(items ?? []).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">{i.description}</div>
                    {i.description_en && <div className="text-sm text-ink-3" dir="ltr" style={{ textAlign: "start" }}>{i.description_en}</div>}
                    <div className="text-xs text-ink-3">الكمية <span className="num">{Number(i.qty)}</span> × <span className="num">{money(Number(i.govt_unit) + Number(i.fee_unit), "")}</span></div>
                  </div>
                  <span className="font-semibold num">{money(Number(i.qty) * (Number(i.govt_unit) + Number(i.fee_unit)))}</span>
                </li>
              ))}
            </ul>
            {full?.notes && <p className="whitespace-pre-wrap border-t border-line px-4 py-3 text-sm text-ink-2">{full.notes}</p>}
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="الإجمالي" />
            <dl className="space-y-3 p-4 text-[15px]">
              <div className="flex justify-between"><dt className="text-ink-2">مجموع البنود</dt><dd className="num font-medium">{money(q.items_total)}</dd></div>
              {Number(q.discount) > 0 && <div className="flex justify-between"><dt className="text-ink-2">خصم</dt><dd className="num font-medium">−{money(q.discount)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-3"><dt className="font-semibold">الإجمالي</dt><dd className="num text-lg font-bold text-navy">{money(q.total)}</dd></div>
              {q.valid_until && <div className="flex justify-between text-sm"><dt className="text-ink-3">صالح حتى</dt><dd className="num">{fmtDate(q.valid_until)}</dd></div>}
              {q.party_phone && <div className="flex justify-between text-sm"><dt className="text-ink-3">الهاتف</dt><dd className="num" dir="ltr">{q.party_phone}</dd></div>}
            </dl>
          </Card>
          {s.perms.has("txn.delete") && !converted && (
            <ConfirmButton variant="danger" className="w-full" title="حذف عرض السعر" message="سيُحذف عرض السعر من القائمة." action={deleteQuote.bind(null, id)} confirmLabel="حذف"><Trash2 /> حذف العرض</ConfirmButton>
          )}
        </div>
      </div>
    </>
  );
}
