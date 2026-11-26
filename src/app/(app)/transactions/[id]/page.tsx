import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Printer, Receipt } from "lucide-react";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PayDialog } from "@/components/transactions/pay-dialog";
import { StatusStepper } from "@/components/transactions/status-stepper";
import { ReceiptButton } from "@/components/transactions/receipt-button";
import { DocumentsPanel, type DocRow } from "@/components/documents/documents-panel";
import { ShareDialog } from "@/components/share/share-dialog";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { deleteTransaction, recordGovtFee, recordPayment, updatePayment } from "@/modules/transactions/actions";
import { LEDGER_KIND_LABEL, METHOD_LABEL, PAY_STATUS_LABEL, TXN_STATUS_LABEL } from "@/lib/permissions";
import { fmtDate, fmtDateTime, money } from "@/lib/utils";

type Pay = {
  id: string; amount: number; method: string; occurred_at: string; description: string | null; voided: boolean;
  reference_no: string | null; paid_by: string | null; has_receipt: boolean; recorded_by: string | null; account_id: string | null;
};
type Hist = { id: number; at: string; user_name: string | null; entity: string; action: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null };

function describe(h: Hist) {
  const n = h.new_data, o = h.old_data;
  if (h.entity === "transactions") {
    if (h.action === "insert") return "سُجّلت المعاملة";
    if (n && o && n.status !== o.status) return `تغيّرت الحالة إلى «${TXN_STATUS_LABEL[String(n.status)] ?? n.status}»`;
    if (n?.deleted_at && !o?.deleted_at) return "حُذفت المعاملة";
    return "عُدّلت بيانات المعاملة";
  }
  if (h.entity === "ledger_entries") {
    const d = n ?? o ?? {};
    const what = d.kind === "client_payment" ? "دفعة مستلمة" : d.kind === "govt_fee" ? "سداد رسوم حكومية" : LEDGER_KIND_LABEL[String(d.kind)] ?? "حركة";
    const meth = d.method ? ` (${METHOD_LABEL[String(d.method)] ?? ""})` : "";
    if (n?.voided_at && !o?.voided_at) return `أُلغيت ${what} بقيمة ${money(Number(d.amount))}`;
    return `${what} ${money(Number(d.amount))}${meth}`;
  }
  if (h.entity === "documents") {
    const d = n ?? o ?? {};
    return h.action === "insert" ? `أُرفق مستند: ${d.title ?? ""}` : d.deleted_at ? `حُذف مستند: ${d.title ?? ""}` : `عُدّل مستند: ${d.title ?? ""}`;
  }
  return "تحديث";
}

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePage();
  const supabase = await createClient();
  const { data: t } = await supabase.from("transactions_list").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();

  const [{ data: notes }, { data: pays }, { data: accounts }, { data: docs }, { data: types }, { data: client }, { data: hist }] = await Promise.all([
    supabase.from("transactions").select("internal_notes,renewal_of_document").eq("id", id).single(),
    supabase.rpc("transaction_payments", { p_txn: id }),
    supabase.rpc("payable_accounts"),
    supabase.from("documents").select("id,group_id,title,type_id,issue_date,expiry_date,is_current,created_at,transaction_id,folder,tag,document_types(name)").eq("transaction_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("document_types").select("id,name").order("sort_order"),
    supabase.from("clients").select("phone,whatsapp").eq("id", t.client_id).single(),
    supabase.rpc("transaction_history", { p_txn: id }),
  ]);
  // Government-fee payouts are visible only to those who can read the treasury (RLS enforces this)
  const { data: govt } = await supabase.from("ledger_entries")
    .select("id,amount,method,occurred_at,description,voided_at,reference_no,receipt_path,profiles(full_name)")
    .eq("transaction_id", id).eq("kind", "govt_fee").order("occurred_at");

  const { data: lineItems } = await supabase.from("transaction_items").select("id,description,description_en,qty,govt_unit,fee_unit").eq("transaction_id", id).order("position");
  const docRows: DocRow[] = (docs ?? []).map((d) => ({
    ...(d as unknown as DocRow),
    type_name: (d as unknown as { document_types: { name: string } | null }).document_types?.name ?? "",
  }));
  const paidList = (pays ?? []) as Pay[];
  const history = (hist ?? []) as Hist[];
  const canTxn = s.perms.has("txn.write");
  const remaining = Number(t.remaining);
  const cancelled = t.status === "cancelled";

  // One plain sentence that tells the story of this transaction
  const sentence =
    cancelled ? "هذه المعاملة ملغاة."
    : `${TXN_STATUS_LABEL[t.status] === "مكتملة" ? "المعاملة مكتملة" : `المعاملة ${TXN_STATUS_LABEL[t.status]}`}. ` +
      (Number(t.paid) === 0 ? `لم يدفع العميل شيئاً بعد من ${money(t.total)}.`
        : remaining <= 0 ? `دفع العميل المبلغ كاملاً (${money(t.total)}).`
        : `دفع العميل ${money(t.paid)} من ${money(t.total)}، والمتبقي ${money(remaining)}.`);

  return (
    <>
      <PageHeader
        back={{ href: "/transactions", label: "رجوع للمعاملات" }}
        title={t.title}
        description={`رقم المعاملة ${t.ref_no}`}
        actions={
          <>
            <Button asChild variant="outline"><a href={`/print/${id}`} target="_blank" rel="noreferrer"><Printer /> الفاتورة</a></Button>
            {paidList.some((p) => !p.voided) && (
              <Button asChild variant="outline"><a href={`/print/${id}?type=receipt`} target="_blank" rel="noreferrer"><Receipt /> إيصال استلام</a></Button>
            )}
            {s.perms.has("share.create") && <ShareDialog scope="transaction" transactionId={id} clientId={t.client_id} phone={client?.whatsapp || client?.phone} />}
            {canTxn && <Button asChild variant="outline"><Link href={`/transactions/${id}/edit`}><Pencil /> تعديل</Link></Button>}
          </>
        }
      />

      <div className={`mb-4 rounded-card border px-4 py-3.5 text-[15px] font-medium leading-7 ${cancelled ? "border-line bg-mute-soft text-mute" : remaining > 0 ? "border-warn/40 bg-warn-soft text-warn" : "border-ok/40 bg-ok-soft text-ok"}`}>
        {sentence}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <StatusStepper id={id} status={t.status} canWrite={canTxn} />

          <Card>
            <CardHeader title="بيانات المعاملة" />
            <dl className="grid gap-x-6 gap-y-4 p-4 text-[15px] sm:grid-cols-2">
              <div><dt className="text-sm text-ink-3">العميل</dt><dd className="mt-0.5 font-semibold"><Link className="hover:text-navy" href={`/clients/${t.client_id}`}>{t.client_name}</Link></dd></div>
              <div><dt className="text-sm text-ink-3">سجّلها</dt><dd className="mt-0.5">{t.created_by_name ?? "—"} <span className="text-sm text-ink-3 num">· {fmtDateTime(t.created_at)}</span></dd></div>
              <div><dt className="text-sm text-ink-3">الموظف المسؤول عن المتابعة</dt><dd className="mt-0.5">{t.assignee_name ?? "غير محدد"}</dd></div>
              <div><dt className="text-sm text-ink-3">موعد التسليم المتوقع</dt><dd className="mt-0.5 num">{fmtDate(t.due_date)}</dd></div>
              {t.completed_at && <div><dt className="text-sm text-ink-3">تاريخ الإنجاز</dt><dd className="mt-0.5 num">{fmtDateTime(t.completed_at)}</dd></div>}
              {notes?.internal_notes && (
                <div className="sm:col-span-2"><dt className="text-sm text-ink-3">ملاحظات المكتب</dt><dd className="mt-1 whitespace-pre-wrap rounded-ctl bg-bg p-3 text-sm text-ink-2">{notes.internal_notes}</dd></div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="بنود المعاملة (ما تتضمنه الفاتورة)" action={canTxn ? <Button asChild size="sm" variant="ghost"><Link href={`/transactions/${id}/edit`}>تعديل البنود</Link></Button> : undefined} />
            <ul className="divide-y divide-line">
              {(lineItems ?? []).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[15px]">
                  <div className="min-w-0 flex-1"><div className="font-medium">{i.description}</div>{i.description_en && <div className="text-sm text-ink-3" dir="ltr" style={{ textAlign: "start" }}>{i.description_en}</div>}<div className="text-xs text-ink-3">الكمية <span className="num">{Number(i.qty)}</span> × <span className="num">{money(Number(i.govt_unit) + Number(i.fee_unit), "")}</span></div></div>
                  <span className="font-semibold num">{money(Number(i.qty) * (Number(i.govt_unit) + Number(i.fee_unit)))}</span>
                </li>
              ))}
            </ul>
            {t.quote_id && <div className="border-t border-line px-4 py-2.5 text-sm"><Link className="text-navy underline" href={`/quotes/${t.quote_id}`}>هذه المعاملة جاءت من عرض سعر، افتح العرض</Link></div>}
            {t.invoice_no && <div className="border-t border-line px-4 py-2.5 text-sm text-ink-2">رقم الفاتورة الرسمي: <b className="num">{t.invoice_no}</b></div>}
          </Card>

          <Card>
            <CardHeader
              title="الدفعات التي استلمناها من العميل"
              action={canTxn && !cancelled && remaining > 0 && (accounts?.length ?? 0) > 0 && (
                <PayDialog title="تسجيل دفعة من العميل" hint="سجّل المبلغ وطريقة الدفع. وإن كانت حوالة فاكتب رقمها وأرفق إشعار الحوالة." trigger="تسجيل دفعة" action={recordPayment.bind(null, id)} accounts={accounts ?? []} defaultAmount={remaining} variant="primary" />
              )}
            />
            {paidList.length === 0 ? (
              <Empty icon={<FileText />} title="لا توجد دفعات بعد" hint={canTxn && remaining > 0 ? "عندما يدفع العميل اضغط «تسجيل دفعة»" : undefined} />
            ) : (
              <ul className="divide-y divide-line">
                {paidList.map((p) => (
                  <li key={p.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 ${p.voided ? "opacity-50" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                        <span className={`num ${p.voided ? "line-through" : "text-ok"}`}>{money(p.amount)}</span>
                        <Badge tone={p.method === "bank_transfer" ? "navy" : p.method === "cheque" ? "orange" : "mute"}>{METHOD_LABEL[p.method] ?? p.method}</Badge>
                        {p.voided && <Badge tone="mute">ملغاة</Badge>}
                      </div>
                      <div className="mt-1 space-y-0.5 text-sm text-ink-3">
                        <div>تاريخ الدفع: <span className="font-medium text-ink-2 num">{fmtDate(p.occurred_at)}</span>{p.recorded_by ? <> · سجّلها {p.recorded_by}</> : null}</div>
                        {p.reference_no && <div>{p.method === "cheque" ? "رقم الشيك" : "رقم الحوالة / العملية"}: <span className="font-medium text-ink-2 num">{p.reference_no}</span></div>}
                        {p.paid_by && <div>المحوِّل / الدافع: <span className="font-medium text-ink-2">{p.paid_by}</span></div>}
                        {p.description && <div>ملاحظة: {p.description}</div>}
                      </div>
                    </div>
                    {p.has_receipt && <ReceiptButton entryId={p.id} />}
                    {canTxn && !p.voided && !cancelled && (accounts?.length ?? 0) > 0 && (
                      <PayDialog
                        title="تعديل الدفعة" hint="غيّر أي معلومة: المبلغ أو طريقة الدفع أو الحساب أو التاريخ أو الرقم. يُحفظ التعديل في سجل النشاط."
                        trigger="تعديل" action={updatePayment.bind(null, id, p.id)} accounts={accounts ?? []}
                        initial={{ amount: Number(p.amount), occurred_at: String(p.occurred_at).slice(0, 10), method: p.method, account_id: p.account_id, reference_no: p.reference_no, paid_by: p.paid_by, note: p.description }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {s.perms.has("treasury.view") && (
            <Card>
              <CardHeader
                title="الرسوم الحكومية التي دفعناها عن العميل"
                action={s.perms.has("treasury.write") && !cancelled && (accounts?.length ?? 0) > 0 && (
                  <PayDialog title="تسجيل دفع رسوم حكومية" hint="المبلغ الذي دفعته للجهة الحكومية من الكاش أو البطاقة." trigger="تسجيل دفع رسوم" action={recordGovtFee.bind(null, id)} accounts={accounts ?? []} defaultAmount={Number(t.govt_fees)} payer={false} />
                )}
              />
              {!govt?.length ? (
                <Empty title="لم تُسجَّل رسوم حكومية بعد" hint={`المطلوب حسب المعاملة: ${money(t.govt_fees)}`} />
              ) : (
                <ul className="divide-y divide-line">
                  {govt.map((g) => {
                    const who = (g as unknown as { profiles: { full_name: string } | null }).profiles?.full_name;
                    return (
                      <li key={g.id} className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${g.voided_at ? "opacity-50" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold"><span className={`text-bad num ${g.voided_at ? "line-through" : ""}`}>−{money(g.amount)}</span><Badge tone="mute">{METHOD_LABEL[g.method ?? ""] ?? ""}</Badge></div>
                          <div className="mt-1 text-sm text-ink-3"><span className="num">{fmtDate(g.occurred_at)}</span>{g.reference_no ? <> · رقم العملية <span className="num">{g.reference_no}</span></> : null}{who ? ` · سجّلها ${who}` : ""}</div>
                        </div>
                        {g.receipt_path && <ReceiptButton entryId={g.id} kind="ledger" />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          <DocumentsPanel
            docs={docRows} types={types ?? []} clientId={t.client_id} transactionId={id}
            canWrite={s.perms.has("docs.write")} canDelete={s.perms.has("docs.delete")} title="الفواتير والإيصالات والمستندات"
          />

          {history.length > 0 && (
            <Card>
              <CardHeader title="سجل المعاملة: من فعل ماذا ومتى" />
              <ul className="divide-y divide-line">
                {history.map((h) => (
                  <li key={h.id} className="px-4 py-3">
                    <div className="text-[15px] text-ink">{describe(h)}</div>
                    <div className="mt-0.5 text-sm text-ink-3">{h.user_name ?? "النظام"} · <span className="num">{fmtDateTime(h.at)}</span></div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="الحساب المالي" action={<Badge tone={STATUS_TONE[t.payment_status]}>{PAY_STATUS_LABEL[t.payment_status]}</Badge>} />
            <dl className="space-y-3 p-4 text-[15px]">
              <Row label="الرسوم الحكومية" value={money(t.govt_fees)} />
              <Row label="أتعاب المكتب" value={money(t.office_fee)} />
              {Number(t.discount) > 0 && <Row label="خصم" value={`−${money(t.discount)}`} />}
              <div className="border-t border-line pt-3"><Row label="المطلوب من العميل" value={money(t.total)} strong /></div>
              <Row label="دفع العميل" value={money(t.paid)} tone="ok" />
              <Row label="المتبقي" value={money(t.remaining)} tone={remaining > 0 ? "bad" : undefined} strong />
            </dl>
          </Card>
          {s.perms.has("txn.delete") && (
            <ConfirmButton variant="danger" className="w-full" title="حذف المعاملة" message="ستُنقل المعاملة إلى سلة المحذوفات ويمكن استرجاعها لاحقاً. تبقى الحركات المالية المرتبطة بها محفوظة." action={deleteTransaction.bind(null, id)} confirmLabel="حذف">
              حذف المعاملة
            </ConfirmButton>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "ok" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`num ${strong ? "text-lg font-bold" : "font-medium"} ${tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : ""}`}>{value}</dd>
    </div>
  );
}
