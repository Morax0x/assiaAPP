"use client";
import { DateField } from "@/components/ui/date-field";
import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/form";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Card, Empty } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterPanel } from "@/components/ui/filter-panel";
import { METHOD_LABEL, PAY_STATUS_LABEL, TXN_STATUS_LABEL } from "@/lib/permissions";
import { cn, fmtDate, money } from "@/lib/utils";

export type TxnRow = {
  id: string; ref_no: string; client_id: string; client_name: string; assignee_id: string | null; assignee_name: string | null;
  title: string; created_by_name: string | null; status: string; govt_fees: number; office_fee: number; discount: number;
  total: number; paid: number; remaining: number; payment_status: string; created_at: string;
  service_name: string | null; method: string | null; paid_on: string | null;
};
type Opt = { id: string; name: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function range(key: string): [string, string] {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const day = (n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d; };
  if (key === "today") return [iso(t), iso(t)];
  if (key === "yesterday") return [iso(day(-1)), iso(day(-1))];
  if (key === "week") { const s = day(-((t.getDay() + 1) % 7)); return [iso(s), iso(t)]; } // week starts Saturday
  if (key === "month") return [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)];
  if (key === "lastmonth") return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), iso(new Date(t.getFullYear(), t.getMonth(), 0))];
  return ["", ""];
}
const PRESETS = [["", "الكل"], ["today", "اليوم"], ["yesterday", "أمس"], ["week", "هذا الأسبوع"], ["month", "هذا الشهر"], ["lastmonth", "الشهر الماضي"]] as const;
const PAGE = 25;

type SortKey = "created_at" | "client_name" | "total" | "remaining";

export function TransactionsTable({ rows, clients, staff, canFees = true }: { rows: TxnRow[]; clients: Opt[]; staff: Opt[]; canFees?: boolean }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [pay, setPay] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [client, setClient] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [preset, setPreset] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sort, setSort] = React.useState<{ k: SortKey; dir: 1 | -1 }>({ k: "created_at", dir: -1 });
  const [page, setPage] = React.useState(0);

  const pick = (k: string) => { setPreset(k); const [a, b] = range(k); setFrom(a); setTo(b); setPage(0); };
  const data = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = rows.filter((r) =>
      (!status || r.status === status) && (!pay || r.payment_status === pay) && (!method || r.method === method) &&
      (!client || r.client_id === client) && (!assignee || r.assignee_id === assignee) &&
      (!from || r.created_at.slice(0, 10) >= from) && (!to || r.created_at.slice(0, 10) <= to) &&
      (!t || r.ref_no.toLowerCase().includes(t) || r.title.toLowerCase().includes(t) || r.client_name.toLowerCase().includes(t) || (r.service_name ?? "").toLowerCase().includes(t)));
    return list.sort((a, b) => {
      const x = a[sort.k], y = b[sort.k];
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ar")) * sort.dir;
    });
  }, [rows, q, status, pay, method, client, assignee, from, to, sort]);

  const sums = React.useMemo(() => ({
    total: data.reduce((a, r) => a + Number(r.total), 0), govt: data.reduce((a, r) => a + Number(r.govt_fees), 0),
    office: data.reduce((a, r) => a + Number(r.office_fee), 0), remaining: data.reduce((a, r) => a + Number(r.remaining), 0),
  }), [data]);
  const active = !!(q || status || pay || method || client || assignee || from || to);
  const clear = () => { setQ(""); setStatus(""); setPay(""); setMethod(""); setClient(""); setAssignee(""); pick(""); };
  const pages = Math.max(1, Math.ceil(data.length / PAGE));
  const shown = data.slice(page * PAGE, page * PAGE + PAGE);
  const th = (label: string, k?: SortKey, cls = "") => (
    <th className={cn("whitespace-nowrap px-3 py-3 text-start text-xs font-semibold text-ink-3", cls)}>
      {k ? <button type="button" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))} className="hover:text-ink">{label}{sort.k === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</button> : label}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {PRESETS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => pick(k)} className={cn("h-10 shrink-0 rounded-ctl border px-4 text-[15px] font-medium", preset === k && !(k === "" && (from || to)) ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink-2 hover:bg-bg")}>{label}</button>
        ))}
      </div>

      <FilterPanel active={active} onClear={clear}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="بحث: رقم، عميل، نوع المعاملة" className="ps-9" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="الحالة">
            <option value="">كل حالات المعاملة</option>
            {Object.entries(TXN_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={pay} onChange={(e) => { setPay(e.target.value); setPage(0); }} aria-label="حالة الدفع">
            <option value="">كل حالات الدفع</option>
            {Object.entries(PAY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(0); }} aria-label="طريقة الدفع">
            <option value="">كل طرق الدفع</option>
            {Object.entries(METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={assignee} onChange={(e) => { setAssignee(e.target.value); setPage(0); }} aria-label="الموظف">
            <option value="">كل الموظفين</option>
            {staff.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={client} onChange={(e) => { setClient(e.target.value); setPage(0); }} aria-label="العميل" className="sm:col-span-2">
            <option value="">كل العملاء</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-xs text-ink-3">من <DateField value={from} onChange={(v) => { setFrom(v); setPreset("custom"); setPage(0); }} ariaLabel="من تاريخ" /></label>
          <label className="flex items-center gap-2 text-xs text-ink-3">إلى <DateField value={to} onChange={(v) => { setTo(v); setPreset("custom"); setPage(0); }} ariaLabel="إلى تاريخ" /></label>
        </div>
      </FilterPanel>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {([["عدد المعاملات", String(data.length), "text-navy bg-navy-soft"], ["الإجمالي", money(sums.total), "text-ink bg-mute-soft"], ...(canFees ? [["الرسوم الحكومية", money(sums.govt), "text-ink bg-mute-soft"], ["رسوم المكتب", money(sums.office), "text-ok bg-ok-soft"]] : []), ["المتبقي", money(sums.remaining), sums.remaining > 0 ? "text-bad bg-bad-soft" : "text-ink-3 bg-mute-soft"]] as unknown as readonly (readonly [string, string, string])[]).map(([l, v, c]) => (
          <div key={l} className={cn("rounded-card px-3 py-2", c)}><div className="text-xs opacity-80">{l}</div><div className="text-[17px] font-bold num">{v}</div></div>
        ))}
      </div>

      {data.length === 0 ? (
        <Card><Empty title="لا توجد معاملات مطابقة" hint="غيّر الفترة أو امسح البحث" /></Card>
      ) : (
        <>
          {/* phones: cards */}
          <div className="space-y-2 lg:hidden">
            {shown.map((r) => (
              <Link key={r.id} href={`/transactions/${r.id}`} className="block rounded-card border border-line bg-surface p-3.5 active:bg-bg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold" dir="auto">{r.client_name}</div>
                    <div className="truncate text-sm text-ink-2" dir="auto">{r.service_name ?? r.title}</div>
                    <div className="text-xs text-ink-3"><span className="num">{r.ref_no}</span> · <span className="num">{fmtDate(r.created_at)}</span></div>
                  </div>
                  <div className="text-end"><div className="text-[15px] font-bold num">{money(r.total)}</div>{r.remaining > 0 && <div className="text-xs text-bad num">متبقي {money(r.remaining)}</div>}</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS_TONE[r.status]}>{TXN_STATUS_LABEL[r.status]}</Badge>
                  <Badge tone={STATUS_TONE[r.payment_status]}>{PAY_STATUS_LABEL[r.payment_status]}</Badge>
                  {r.method && <span className="text-xs text-ink-3">{METHOD_LABEL[r.method] ?? r.method}</span>}
                </div>
              </Link>
            ))}
          </div>

          {/* computer: full table, in the order of the office's own sheet */}
          <Card className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b border-line bg-bg">
                <tr>
                  {th("التاريخ", "created_at")}{th("اسم الزبون", "client_name")}{th("نوع المعاملة")}{th("حالة المعاملة")}
                  {canFees && th("رسوم المكتب")}{canFees && th("الرسوم")}{th("المجموع", "total")}{th("حالة الدفع")}{th("طريقة الدفع")}{th("تاريخ التحويل")}{th("المتبقي", "remaining")}{th("الموظف")}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((r) => (
                  <tr key={r.id} className="group relative hover:bg-bg">
                    <td className="whitespace-nowrap px-3 py-3 num text-ink-2"><Link href={`/transactions/${r.id}`} className="after:absolute after:inset-0">{fmtDate(r.created_at)}</Link></td>
                    <td className="max-w-52 truncate px-3 py-3 font-semibold" dir="auto">{r.client_name}</td>
                    <td className="max-w-56 truncate px-3 py-3" dir="auto">{r.service_name ?? r.title}</td>
                    <td className="px-3 py-3"><Badge tone={STATUS_TONE[r.status]}>{TXN_STATUS_LABEL[r.status]}</Badge></td>
                    {canFees && <td className="px-3 py-3 num">{money(r.office_fee)}</td>}
                    {canFees && <td className="px-3 py-3 num">{money(r.govt_fees)}</td>}
                    <td className="px-3 py-3 font-bold num">{money(r.total)}</td>
                    <td className="px-3 py-3"><Badge tone={STATUS_TONE[r.payment_status]}>{PAY_STATUS_LABEL[r.payment_status]}</Badge></td>
                    <td className="px-3 py-3 text-ink-2">{r.method ? METHOD_LABEL[r.method] ?? r.method : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 num text-ink-2">{r.paid_on ? fmtDate(r.paid_on) : "—"}</td>
                    <td className={cn("px-3 py-3 num", r.remaining > 0 ? "font-semibold text-bad" : "text-ink-3")}>{money(r.remaining)}</td>
                    <td className="px-3 py-3 text-ink-2">{r.assignee_name ?? r.created_by_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {pages > 1 && (
            <div className="flex items-center justify-between text-sm text-ink-3">
              <span className="num">{page + 1} / {pages} — {data.length} معاملة</span>
              <div className="flex gap-1.5">
                <Button variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>السابق</Button>
                <Button variant="outline" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>التالي</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
