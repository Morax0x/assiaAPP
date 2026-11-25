import Link from "next/link";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { ExportButton } from "@/components/import-export/export-button";
import { METHOD_LABEL } from "@/lib/permissions";
import { money } from "@/lib/utils";
import { RangePicker } from "./range-picker";
import { CashflowChart } from "../dashboard/cashflow-chart";

export const metadata = { title: "التقارير" };

type Rep = {
  income: number; govt_paid: number; expenses: number; billed_fees: number; billed_total: number; txn_count: number; completed_count: number;
  expenses_by_category: { name: string; total: number }[];
  by_employee: { name: string; count: number; fees: number }[];
  top_clients: { id: string; name: string; total: number; count: number }[];
  by_method: { method: string | null; total: number }[];
  aging: { d0_30: number; d31_60: number; d61_90: number; d90p: number; total: number };
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePage("reports.view");
  const sp = await searchParams;
  const now = new Date();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : iso(now);

  const supabase = await createClient();
  const [{ data }, { data: monthly }] = await Promise.all([
    supabase.rpc("period_report", { p_from: from, p_to: to }),
    supabase.rpc("monthly_summary", { p_months: 6 }),
  ]);
  const r = (data ?? {}) as Rep;
  const net = Number(r.income) - Number(r.govt_paid) - Number(r.expenses);
  const series = ((monthly ?? []) as { month: string; income: number; govt_paid: number; expenses: number; office_net: number }[]).map((m) => ({
    month: new Intl.DateTimeFormat("ar-AE-u-nu-latn", { month: "short" }).format(new Date(m.month)),
    income: Number(m.income), outgoing: Number(m.govt_paid) + Number(m.expenses), net: Number(m.office_net),
  }));

  return (
    <>
      <PageHeader title="التقارير والأرباح" description="كم دخل وكم خرج وكم ربح المكتب في أي فترة تختارها. كل الأرقام تُحسب تلقائياً." actions={<ExportButton type="report" label="تصدير Excel" />} />
      <RangePicker from={from} to={to} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="الوارد (دفعات العملاء)" value={money(r.income)} tone="ok" />
        <Stat label="رسوم حكومية مدفوعة" value={money(r.govt_paid)} />
        <Stat label="مصاريف تشغيلية" value={money(r.expenses)} />
        <Stat label="صافي الكاش للفترة" value={money(net)} tone={net < 0 ? "bad" : "ok"} strong />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="أتعاب مفوترة (ربح المكتب)" value={money(r.billed_fees)} hint="بعد الخصم، حسب تاريخ المعاملة" />
        <Stat label="إجمالي الفواتير" value={money(r.billed_total)} />
        <Stat label="عدد المعاملات" value={String(r.txn_count ?? 0)} hint={`${r.completed_count ?? 0} مكتملة`} />
        <Stat label="إجمالي المستحق حالياً" value={money(r.aging?.total)} tone={Number(r.aging?.total) > 0 ? "bad" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="المصاريف حسب البند" />
          <List rows={(r.expenses_by_category ?? []).map((x) => [x.name, money(x.total)])} />
        </Card>
        <Card>
          <CardHeader title="الدفعات حسب الوسيلة" />
          <List rows={(r.by_method ?? []).map((x) => [x.method ? METHOD_LABEL[x.method] : "—", money(x.total)])} />
        </Card>
        <Card>
          <CardHeader title="أداء الموظفين (أتعاب مفوترة)" />
          <List rows={(r.by_employee ?? []).map((x) => [`${x.name} (${x.count})`, money(x.fees)])} />
        </Card>
        <Card>
          <CardHeader title="أعلى العملاء" />
          {!(r.top_clients ?? []).length ? <Empty title="لا توجد بيانات" /> : (
            <ul className="divide-y divide-line text-sm">
              {r.top_clients.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <Link href={`/clients/${c.id}`} className="hover:text-navy">{c.name} <span className="text-xs text-ink-3">({c.count})</span></Link>
                  <span className="num">{money(c.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="أعمار الديون (المستحق حسب عمر المعاملة)" />
          <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
            {([["0 - 30 يوم", r.aging?.d0_30], ["31 - 60 يوم", r.aging?.d31_60], ["61 - 90 يوم", r.aging?.d61_90], ["أكثر من 90 يوم", r.aging?.d90p]] as const).map(([l, v], i) => (
              <div key={l} className="bg-surface p-4">
                <div className="text-xs text-ink-3">{l}</div>
                <div className={`mt-1 text-lg font-semibold ${i === 3 && Number(v) > 0 ? "text-bad" : ""}`}><span className="num">{money(v)}</span></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="الوارد والمنصرف — آخر 6 أشهر" />
          <div className="p-4">{series.length ? <CashflowChart data={series} /> : <Empty title="لا توجد حركات" />}</div>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, hint, tone, strong }: { label: string; value: string; hint?: string; tone?: "ok" | "bad"; strong?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className={`mt-2 whitespace-nowrap text-[17px] sm:text-xl ${strong ? "font-bold" : "font-semibold"} ${tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : ""}`}><span className="num">{value}</span></div>
      {hint && <div className="mt-1 text-xs text-ink-3">{hint}</div>}
    </Card>
  );
}

function List({ rows }: { rows: [string, string][] }) {
  if (!rows.length) return <Empty title="لا توجد بيانات في هذه الفترة" />;
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map(([a, b], i) => (
        <li key={i} className="flex items-center justify-between px-4 py-2.5"><span>{a}</span><span className="num">{b}</span></li>
      ))}
    </ul>
  );
}
