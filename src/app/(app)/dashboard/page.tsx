import Link from "next/link";
import { AlertTriangle, ArrowLeft, Banknote, CircleCheck, CreditCard, FileClock, FilePlus2, Receipt, ScanSearch, Upload, UserPlus, WalletCards } from "lucide-react";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui/card";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { BUCKET_LABEL, LEDGER_KIND_LABEL, TXN_STATUS_LABEL } from "@/lib/permissions";
import { daysLabel, fmtDate, fmtDateTime, money } from "@/lib/utils";
import { CashflowChart } from "./cashflow-chart";

export const metadata = { title: "لوحة التحكم" };

type Stats = { cash_balance: number | null; bank_balance: number | null; in_progress: number; completed_month: number; urgent_docs: number };

export default async function DashboardPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const canReports = s.perms.has("reports.view");
  const canTreasury = s.perms.has("treasury.view");

  const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const [{ data: stats }, { data: alerts }, { data: recentTxn }, chart, ledger, { data: attention }] = await Promise.all([
    supabase.rpc("dashboard_stats"),
    supabase.from("document_alerts").select("id,client_id,client_name,type_name,title,expiry_date,days_left,bucket").in("bucket", ["expired", "critical", "upcoming"]).order("expiry_date").limit(5),
    supabase.from("transactions_list").select("id,ref_no,title,client_name,status,total,created_at").order("created_at", { ascending: false }).limit(5),
    canReports ? supabase.rpc("monthly_summary", { p_months: 6 }) : Promise.resolve({ data: null }),
    canTreasury
      ? supabase.from("ledger_entries").select("id,direction,kind,amount,occurred_at,description,accounts(name),expense_categories(name)").is("voided_at", null).order("occurred_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: null }),
    supabase.from("transactions_list").select("id,ref_no,title,client_name,status,due_date,remaining")
      .in("status", ["new", "in_progress", "awaiting_docs"]).not("due_date", "is", null).lte("due_date", soon).order("due_date").limit(5),
  ]);
  const st = (stats ?? {}) as Stats;
  const series = ((chart.data ?? []) as { month: string; income: number; govt_paid: number; expenses: number; office_net: number }[]).map((m) => ({
    month: new Intl.DateTimeFormat("ar-AE-u-nu-latn", { month: "short" }).format(new Date(m.month)),
    income: Number(m.income), outgoing: Number(m.govt_paid) + Number(m.expenses), net: Number(m.office_net),
  }));

  return (
    <>
      <PageHeader title={`مرحباً ${s.profile.full_name.split(" ")[0]}`} description={new Intl.DateTimeFormat("ar-AE", { dateStyle: "full" }).format(new Date())} />

      <nav aria-label="إجراءات سريعة" className="mb-5 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {([
          s.perms.has("txn.write") && { href: "/transactions/new", label: "معاملة جديدة", icon: FilePlus2, main: true },
          s.perms.has("clients.write") && { href: "/clients/new", label: "عميل جديد", icon: UserPlus },
          s.perms.has("docs.write") && { href: "/documents/new", label: "رفع مستند", icon: Upload },
          s.perms.has("treasury.write") && { href: "/treasury?new=expense", label: "تسجيل مصروف", icon: Receipt },
          { href: "/receivables", label: "المستحقات", icon: WalletCards },
          { href: "/search", label: "بحث ذكي", icon: ScanSearch },
        ].filter(Boolean) as { href: string; label: string; icon: typeof Upload; main?: boolean }[]).map((a) => (
          <Link
            key={a.href} href={a.href}
            className={`flex min-h-[5.25rem] flex-col items-center justify-center gap-2 rounded-card border px-2 py-3 text-center text-[13px] font-medium leading-tight transition-colors sm:text-sm ${a.main ? "border-orange bg-orange text-white hover:bg-orange-hover" : "border-line bg-surface text-ink hover:border-navy hover:bg-navy-soft"}`}
          >
            <a.icon className={`size-6 ${a.main ? "" : "text-navy"}`} strokeWidth={1.6} />
            {a.label}
          </Link>
        ))}
      </nav>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Banknote} label="رصيد الكاش" value={st.cash_balance === null || st.cash_balance === undefined ? null : money(st.cash_balance)} />
        <Kpi icon={CreditCard} label="رصيد بطاقة البنك" value={st.bank_balance === null || st.bank_balance === undefined ? null : money(st.bank_balance)} />
        <Kpi icon={FileClock} label="معاملات قيد الإجراء" value={String(st.in_progress ?? 0)} sub={`${st.completed_month ?? 0} مكتملة هذا الشهر`} href="/transactions" />
        <Kpi icon={AlertTriangle} label="تنبيهات عاجلة" value={String(st.urgent_docs ?? 0)} sub="منتهية أو قريبة الانتهاء" tone={Number(st.urgent_docs) > 0 ? "warn" : undefined} href="/alerts" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="مستندات تقترب من الانتهاء" action={<Button asChild variant="ghost" size="sm"><Link href="/alerts">عرض الكل <ArrowLeft /></Link></Button>} />
          {!alerts?.length ? (
            <Empty icon={<CircleCheck />} title="لا توجد تنبيهات حالياً" hint="كل المستندات سارية" />
          ) : (
            <ul className="divide-y divide-line">
              {alerts.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.client_name}</div>
                    <div className="truncate text-xs text-ink-3">{a.type_name} · <span className="num">{fmtDate(a.expiry_date)}</span></div>
                  </div>
                  <Badge tone={STATUS_TONE[a.bucket]}>{BUCKET_LABEL[a.bucket]} · {daysLabel(a.days_left)}</Badge>
                  <Button asChild size="sm" variant="outline"><Link href="/alerts">إجراء</Link></Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {(attention?.length ?? 0) > 0 && (
          <Card className="lg:col-span-5">
            <CardHeader title="معاملات تحتاج متابعة (متأخرة أو يحين موعدها خلال 3 أيام)" />
            <ul className="divide-y divide-line">
              {attention!.map((t) => {
                const late = t.due_date < new Date().toISOString().slice(0, 10);
                return (
                  <li key={t.id}>
                    <Link href={`/transactions/${t.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-bg">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.title}</div>
                        <div className="truncate text-xs text-ink-3">{t.client_name} · <span className="num">{t.ref_no}</span></div>
                      </div>
                      <Badge tone={late ? "bad" : "warn"}>{late ? "متأخرة" : "قريبة"} · <span className="num">{fmtDate(t.due_date)}</span></Badge>
                      <Badge tone={STATUS_TONE[t.status]}>{TXN_STATUS_LABEL[t.status]}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader title="آخر المعاملات" action={<Button asChild variant="ghost" size="sm"><Link href="/transactions">الكل <ArrowLeft /></Link></Button>} />
          {!recentTxn?.length ? <Empty title="لا توجد معاملات" /> : (
            <ul className="divide-y divide-line">
              {recentTxn.map((t) => (
                <li key={t.id}>
                  <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-bg">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="truncate text-xs text-ink-3">{t.client_name} · <span className="num">{t.ref_no}</span></div>
                    </div>
                    <div className="text-end">
                      <div className="text-sm font-medium num">{money(t.total)}</div>
                      <Badge tone={STATUS_TONE[t.status]} className="mt-0.5">{TXN_STATUS_LABEL[t.status]}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {canReports && (
          <Card className="lg:col-span-3">
            <CardHeader title="الوارد والمنصرف وصافي الأتعاب — آخر 6 أشهر" />
            <div className="p-4">{series.length ? <CashflowChart data={series} /> : <Empty title="لا توجد حركات بعد" />}</div>
          </Card>
        )}

        {canTreasury && (
          <Card className={canReports ? "lg:col-span-2" : "lg:col-span-5"}>
            <CardHeader title="آخر حركات الخزينة" action={<Button asChild variant="ghost" size="sm"><Link href="/treasury">الكل <ArrowLeft /></Link></Button>} />
            {!ledger.data?.length ? <Empty title="لا توجد حركات" /> : (
              <ul className="divide-y divide-line">
                {(ledger.data as unknown as { id: string; direction: string; kind: string; amount: number; occurred_at: string; accounts: { name: string } | null; expense_categories: { name: string } | null }[]).map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{l.kind === "expense" ? l.expense_categories?.name ?? "مصروف" : LEDGER_KIND_LABEL[l.kind]}</div>
                      <div className="truncate text-xs text-ink-3">{l.accounts?.name} · <span className="num">{fmtDateTime(l.occurred_at)}</span></div>
                    </div>
                    <span className={`font-semibold num ${l.kind === "transfer" ? "" : l.direction === "in" ? "text-ok" : "text-bad"}`}>{l.direction === "in" ? "+" : "−"}{money(l.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, sub, href, tone }: { icon: typeof Banknote; label: string; value: string | null; sub?: string; href?: string; tone?: "warn" }) {
  const body = (
    <Card className="h-full p-4">
      <div className="flex items-center gap-2 text-[13px] text-ink-2">
        <Icon className={`size-4 ${tone === "warn" ? "text-orange" : "text-navy"}`} strokeWidth={1.75} />{label}
      </div>
      {value === null ? (
        <div className="mt-2 text-sm text-ink-3">غير متاح لحسابك</div>
      ) : (
        <div className="mt-2 whitespace-nowrap text-[17px] font-semibold sm:text-xl md:text-2xl"><span className="num">{value}</span></div>
      )}
      {sub && <div className="mt-1 text-xs text-ink-3">{sub}</div>}
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
