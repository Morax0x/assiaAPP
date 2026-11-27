import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone, Plus, Mail, Users } from "lucide-react";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { ActionDialog } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ClientFields } from "@/components/clients/client-form";
import { DocumentsPanel, type DocRow } from "@/components/documents/documents-panel";
import { ShareDialog } from "@/components/share/share-dialog";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { deleteClientAction, updateClientAction } from "@/modules/clients/actions";
import { PAY_STATUS_LABEL, TXN_STATUS_LABEL } from "@/lib/permissions";
import { fmtDate, money, waNumber } from "@/lib/utils";

export const metadata = { title: "ملف العميل" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePage();
  const supabase = await createClient();
  const [{ data: c }, { data: txns }, { data: docs }, { data: types }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("transactions_list").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    supabase.from("documents").select("id,group_id,title,type_id,issue_date,expiry_date,is_current,created_at,transaction_id,folder,tag,document_types(name)").eq("client_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("document_types").select("id,name").order("sort_order"),
  ]);
  if (!c) notFound();

  // People inside this company's file, the list of possible companies, and where documents can be moved
  const [{ data: allClients }, { data: kids }] = await Promise.all([
    supabase.from("clients").select("id,name,kind,parent_id").is("deleted_at", null).order("name"),
    supabase.from("clients").select("id,name,phone").eq("parent_id", id).is("deleted_at", null).order("name"),
  ]);
  const companies = (allClients ?? []).filter((x) => x.kind === "company" && x.id !== id).map((x) => ({ id: x.id as string, name: x.name as string }));
  const moveTargets = (allClients ?? []).map((x) => ({ id: x.id as string, name: x.name as string, kind: x.kind as string, parent_id: (x.parent_id ?? null) as string | null }));
  const parent = c.parent_id ? (allClients ?? []).find((x) => x.id === c.parent_id) : null;
  const kidIds = (kids ?? []).map((k) => k.id as string);
  const { data: kidDocs } = kidIds.length
    ? await supabase.from("documents").select("client_id,expiry_date").in("client_id", kidIds).eq("is_current", true).is("deleted_at", null)
    : { data: [] as { client_id: string; expiry_date: string | null }[] };
  const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const kidStats = new Map<string, { n: number; urgent: number }>();
  (kidDocs ?? []).forEach((d) => {
    const st = kidStats.get(d.client_id) ?? { n: 0, urgent: 0 };
    st.n++; if (d.expiry_date && d.expiry_date <= soon) st.urgent++;
    kidStats.set(d.client_id, st);
  });

  const due = (txns ?? []).filter((t) => t.status !== "cancelled").reduce((a, t) => a + Number(t.remaining), 0);
  const docRows: DocRow[] = (docs ?? []).map((d) => ({
    ...(d as unknown as DocRow),
    type_name: (d as unknown as { document_types: { name: string } | null }).document_types?.name ?? "",
  }));
  const wa = waNumber(c.whatsapp || c.phone);
  const shareDocs = docRows.filter((d) => d.is_current).map((d) => ({ id: d.id, title: d.title }));

  return (
    <>
      <PageHeader
        back={{ href: "/clients", label: "رجوع للعملاء" }}
        title={c.name}
        description={c.kind === "company" ? "شركة / منشأة" : c.kind === "sponsor" ? "كفيل" : "فرد"}
        actions={
          <>
            {wa && (
              <Button asChild variant="outline"><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle /> واتساب</a></Button>
            )}
            <Button asChild variant="outline"><Link href={`/clients/${c.id}/statement`}>كشف حساب</Link></Button>
            {s.perms.has("share.create") && <ShareDialog scope="client_folder" clientId={c.id} phone={c.whatsapp || c.phone} label="مشاركة الملف" />}
            {s.perms.has("txn.write") && (
              <Button asChild variant="accent"><Link href={`/transactions/new?client=${c.id}`}><Plus /> معاملة</Link></Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader
              title="بيانات التواصل"
              action={s.perms.has("clients.write") && (
                <ActionDialog trigger="تعديل" triggerProps={{ size: "sm", variant: "ghost" }} title="تعديل بيانات العميل" action={updateClientAction.bind(null, c.id)}>
                  <ClientFields v={c} companies={companies} />
                </ActionDialog>
              )}
            />
            <dl className="space-y-3 p-4 text-sm">
              <div className="flex items-center gap-2"><Phone className="size-4 text-ink-3" strokeWidth={1.75} /><span className="num">{c.phone || "—"}</span></div>
              {parent && <div className="flex items-center gap-2 text-sm"><Users className="size-4 text-ink-3" strokeWidth={1.75} />يتبع شركة: <Link href={`/clients/${parent.id}`} className="font-medium text-navy hover:underline">{parent.name}</Link></div>}
              <div className="flex items-center gap-2"><Mail className="size-4 text-ink-3" strokeWidth={1.75} /><span dir="ltr">{c.email || "—"}</span></div>
              {c.notes && <p className="rounded-md bg-bg p-2.5 text-xs text-ink-2 whitespace-pre-wrap">{c.notes}</p>}
            </dl>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-ink-3">إجمالي المستحق (الآجل)</div>
            <div className={`mt-1 text-2xl font-semibold ${due > 0 ? "text-bad" : "text-ok"}`}><span className="num">{money(due)}</span></div>
          </Card>
          {s.perms.has("clients.delete") && (
            <ConfirmButton variant="danger" className="w-full" title="حذف العميل" message="سيُخفى العميل من القوائم. تبقى معاملاته وحركاته المالية محفوظة." action={deleteClientAction.bind(null, c.id)} confirmLabel="حذف العميل">
              حذف العميل
            </ConfirmButton>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title={`المعاملات (${txns?.length ?? 0})`} />
            {!txns?.length ? (
              <Empty title="لا توجد معاملات لهذا العميل" />
            ) : (
              <ul className="divide-y divide-line">
                {txns.map((t) => (
                  <li key={t.id}>
                    <Link href={`/transactions/${t.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-bg">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.title}</div>
                        <div className="text-xs text-ink-3"><span className="num">{t.ref_no}</span> · <span className="num">{fmtDate(t.created_at)}</span></div>
                      </div>
                      <Badge tone={STATUS_TONE[t.status]}>{TXN_STATUS_LABEL[t.status]}</Badge>
                      <Badge tone={STATUS_TONE[t.payment_status]}>{PAY_STATUS_LABEL[t.payment_status]}</Badge>
                      <span className="w-28 text-end text-sm font-medium num">{money(t.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {c.kind === "company" && (
            <Card>
              <CardHeader
                title={`موظفو الشركة (${kids?.length ?? 0})`}
                action={s.perms.has("clients.write") && <Button asChild size="sm" variant="primary"><Link href={`/clients/new?kind=individual&parent=${c.id}`}><Plus /> إضافة موظف</Link></Button>}
              />
              {!kids?.length ? (
                <Empty icon={<Users />} title="لا يوجد موظفون داخل ملف هذه الشركة" hint="أضف موظفاً ليكون له مجلد مستندات خاص داخل ملف الشركة (إقامة، جواز، هوية...)" />
              ) : (
                <ul className="divide-y divide-line">
                  {kids.map((k) => {
                    const st = kidStats.get(k.id) ?? { n: 0, urgent: 0 };
                    return (
                      <li key={k.id}>
                        <Link href={`/clients/${k.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-bg">
                          <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-medium">{k.name}</div><div className="text-xs text-ink-3 num">{k.phone || "—"}</div></div>
                          {st.urgent > 0 && <Badge tone="warn">{st.urgent} تحتاج تجديداً</Badge>}
                          <span className="text-sm text-ink-3"><span className="num">{st.n}</span> مستند</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          <DocumentsPanel
            docs={docRows} types={types ?? []} clientId={c.id}
            canWrite={s.perms.has("docs.write")} canDelete={s.perms.has("docs.delete")}
            title="خزانة المستندات" moveTargets={moveTargets}
          />
          {s.perms.has("share.create") && shareDocs.length > 0 && (
            <div className="flex justify-end"><ShareDialog scope="documents" clientId={c.id} documents={shareDocs} phone={c.whatsapp || c.phone} label="مشاركة مستندات محددة" /></div>
          )}
        </div>
      </div>
    </>
  );
}
