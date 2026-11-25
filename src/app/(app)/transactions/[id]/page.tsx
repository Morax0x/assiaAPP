import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Printer, Receipt } from "lucide-react";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { StatusSelect } from "@/components/transactions/status-select";
import { PayDialog } from "@/components/transactions/pay-dialog";
import { DocumentsPanel, type DocRow } from "@/components/documents/documents-panel";
import { ShareDialog } from "@/components/share/share-dialog";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { deleteTransaction, recordGovtFee, recordPayment } from "@/modules/transactions/actions";
import { LEDGER_KIND_LABEL, METHOD_LABEL, PAY_STATUS_LABEL, TXN_STATUS_LABEL } from "@/lib/permissions";
import { fmtDate, fmtDateTime, money } from "@/lib/utils";

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePage();
  const supabase = await createClient();
  const { data: t } = await supabase.from("transactions_list").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();

  const [{ data: notes }, { data: pays }, { data: accounts }, { data: docs }, { data: types }, { data: client }] = await Promise.all([
    supabase.from("transactions").select("internal_notes,renewal_of_document").eq("id", id).single(),
    supabase.rpc("transaction_payments", { p_txn: id }),
    supabase.rpc("payable_accounts"),
    supabase.from("documents").select("id,group_id,title,type_id,issue_date,expiry_date,is_current,created_at,document_types(name)").eq("transaction_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("document_types").select("id,name").order("sort_order"),
    supabase.from("clients").select("phone,whatsapp").eq("id", t.client_id).single(),
  ]);
  // Govt-fee payouts are only visible to those who can read the ledger (RLS enforces this)
  const { data: govt } = await supabase.from("ledger_entries").select("id,amount,method,occurred_at,description,voided_at").eq("transaction_id", id).eq("kind", "govt_fee").order("occurred_at");

  const { data: trail } = s.perms.has("audit.view")
    ? await supabase.from("audit_log").select("id,at,action,entity,user_id,old_data,new_data")
        .or(`and(entity.eq.transactions,entity_id.eq.${id}),and(entity.eq.ledger_entries,new_data->>transaction_id.eq.${id})`)
        .order("at", { ascending: false }).limit(30)
    : { data: null };
  const { data: people } = trail?.length ? await supabase.from("profiles").select("id,full_name") : { data: null };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const docRows: DocRow[] = (docs ?? []).map((d) => ({
    ...(d as unknown as DocRow),
    type_name: (d as unknown as { document_types: { name: string } | null }).document_types?.name ?? "",
  }));
  const paidList = (pays ?? []) as { id: string; amount: number; method: string; occurred_at: string; description: string | null; voided: boolean }[];
  const canTxn = s.perms.has("txn.write");

  return (
    <>
      <PageHeader
        title={t.title}
        description={`${t.ref_no} · ${fmtDate(t.created_at)}`}
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/print/${id}`} target="_blank"><Printer /> فاتورة</Link></Button>
            {paidList.some((p) => !p.voided) && (
              <Button asChild variant="outline"><Link href={`/print/${id}?type=receipt`} target="_blank"><Receipt /> إيصال استلام</Link></Button>
            )}
            {s.perms.has("share.create") && <ShareDialog scope="transaction" transactionId={id} clientId={t.client_id} phone={client?.whatsapp || client?.phone} />}
            {canTxn && <Button asChild variant="outline"><Link href={`/transactions/${id}/edit`}><Pencil /> تعديل</Link></Button>}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="بيانات المعاملة" action={<StatusSelect id={id} status={t.status} disabled={!canTxn} />} />
            <dl className="grid gap-x-6 gap-y-4 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-3">العميل</dt><dd className="mt-0.5 font-medium"><Link className="hover:text-navy" href={`/clients/${t.client_id}`}>{t.client_name}</Link></dd></div>
              <div><dt className="text-xs text-ink-3">الموظف المسؤول</dt><dd className="mt-0.5">{t.assignee_name ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-3">تاريخ الاستحقاق</dt><dd className="mt-0.5 num">{fmtDate(t.due_date)}</dd></div>
              <div><dt className="text-xs text-ink-3">تاريخ الإكمال</dt><dd className="mt-0.5 num">{fmtDate(t.completed_at)}</dd></div>
              {notes?.internal_notes && (
                <div className="sm:col-span-2"><dt className="text-xs text-ink-3">ملاحظات داخلية</dt><dd className="mt-1 rounded-md bg-bg p-2.5 text-xs text-ink-2 whitespace-pre-wrap">{notes.internal_notes}</dd></div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="الدفعات المستلمة"
              action={canTxn && (accounts?.length ?? 0) > 0 && (
                <PayDialog title="تسجيل دفعة من العميل" trigger="دفعة" action={recordPayment.bind(null, id)} accounts={accounts ?? []} defaultAmount={Number(t.remaining)} variant="primary" />
              )}
            />
            {paidList.length === 0 ? (
              <Empty icon={<FileText />} title="لا توجد دفعات بعد" />
            ) : (
              <ul className="divide-y divide-line">
                {paidList.map((p) => (
                  <li key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 text-sm ${p.voided ? "opacity-50 line-through" : ""}`}>
                    <div>
                      <div className="num">{fmtDateTime(p.occurred_at)}</div>
                      <div className="text-xs text-ink-3">{METHOD_LABEL[p.method] ?? ""}{p.description ? ` · ${p.description}` : ""}</div>
                    </div>
                    <span className="font-medium text-ok num">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {s.perms.has("treasury.view") && (
            <Card>
              <CardHeader
                title="الرسوم الحكومية المسددة"
                action={s.perms.has("treasury.write") && (accounts?.length ?? 0) > 0 && (
                  <PayDialog title="تسجيل سداد رسوم حكومية" trigger="سداد رسوم" action={recordGovtFee.bind(null, id)} accounts={accounts ?? []} defaultAmount={Number(t.govt_fees)} />
                )}
              />
              {!govt?.length ? (
                <Empty title="لم تُسدَّد رسوم حكومية بعد" />
              ) : (
                <ul className="divide-y divide-line">
                  {govt.map((g) => (
                    <li key={g.id} className={`flex items-center justify-between px-4 py-3 text-sm ${g.voided_at ? "opacity-50 line-through" : ""}`}>
                      <div>
                        <div className="num">{fmtDateTime(g.occurred_at)}</div>
                        <div className="text-xs text-ink-3">{METHOD_LABEL[g.method ?? ""] ?? LEDGER_KIND_LABEL.govt_fee}</div>
                      </div>
                      <span className="font-medium text-bad num">−{money(g.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <DocumentsPanel
            docs={docRows} types={types ?? []} clientId={t.client_id} transactionId={id}
            canWrite={s.perms.has("docs.write")} canDelete={s.perms.has("docs.delete")} title="مستندات المعاملة"
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="الملخص المالي" action={<Badge tone={STATUS_TONE[t.payment_status]}>{PAY_STATUS_LABEL[t.payment_status]}</Badge>} />
            <dl className="space-y-2.5 p-4 text-sm">
              <Row label="الرسوم الحكومية" value={money(t.govt_fees)} />
              <Row label="أتعاب المكتب" value={money(t.office_fee)} />
              {Number(t.discount) > 0 && <Row label="الخصم" value={`−${money(t.discount)}`} />}
              <div className="border-t border-line pt-2.5"><Row label="الإجمالي" value={money(t.total)} strong /></div>
              <Row label="المدفوع" value={money(t.paid)} tone="ok" />
              <Row label="المتبقي" value={money(t.remaining)} tone={Number(t.remaining) > 0 ? "bad" : undefined} strong />
            </dl>
          </Card>
          {trail && trail.length > 0 && (
            <Card>
              <CardHeader title="سجل المعاملة" />
              <ul className="divide-y divide-line text-xs">
                {trail.map((a) => {
                  const n = a.new_data as Record<string, unknown> | null;
                  const o = a.old_data as Record<string, unknown> | null;
                  const text = a.entity === "ledger_entries"
                    ? `حركة مالية: ${LEDGER_KIND_LABEL[String(n?.kind ?? o?.kind)] ?? ""} ${money(Number(n?.amount ?? o?.amount ?? 0))}${n?.voided_at && !o?.voided_at ? " (إلغاء)" : ""}`
                    : a.action === "insert" ? "إنشاء المعاملة" : n && o && n.status !== o.status ? `تغيير الحالة إلى ${TXN_STATUS_LABEL[String(n.status)] ?? n.status}` : "تعديل بيانات المعاملة";
                  return (
                    <li key={a.id} className="px-4 py-2.5">
                      <div className="text-ink-2">{text}</div>
                      <div className="mt-0.5 text-ink-3">{a.user_id ? who.get(a.user_id) ?? "—" : "النظام"} · <span className="num">{fmtDateTime(a.at)}</span></div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {s.perms.has("txn.delete") && (
            <ConfirmButton variant="danger" className="w-full" title="حذف المعاملة" message="ستُخفى المعاملة من القوائم، وتبقى الحركات المالية المرتبطة محفوظة في الخزينة." action={deleteTransaction.bind(null, id)} confirmLabel="حذف">
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
    <div className="flex items-center justify-between">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`num ${strong ? "font-semibold" : ""} ${tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : ""}`}>{value}</dd>
    </div>
  );
}
