"use client";
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { Input, Select } from "@/components/ui/form";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { PAY_STATUS_LABEL, TXN_STATUS_LABEL } from "@/lib/permissions";
import { fmtDate, money } from "@/lib/utils";

export type TxnRow = {
  id: string; ref_no: string; client_id: string; client_name: string; assignee_id: string | null; assignee_name: string | null;
  title: string; created_by_name: string | null; status: string; total: number; paid: number; remaining: number; payment_status: string; created_at: string;
};
type Opt = { id: string; name: string };

export function TransactionsTable({ rows, clients, staff }: { rows: TxnRow[]; clients: Opt[]; staff: Opt[] }) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [pay, setPay] = React.useState("");
  const [client, setClient] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const data = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) =>
      (!status || r.status === status) && (!pay || r.payment_status === pay) &&
      (!client || r.client_id === client) && (!assignee || r.assignee_id === assignee) &&
      (!from || r.created_at.slice(0, 10) >= from) && (!to || r.created_at.slice(0, 10) <= to) &&
      (!t || r.ref_no.toLowerCase().includes(t) || r.title.toLowerCase().includes(t) || r.client_name.toLowerCase().includes(t)));
  }, [rows, q, status, pay, client, assignee, from, to]);

  const columns = React.useMemo<ColumnDef<TxnRow, unknown>[]>(() => [
    { accessorKey: "ref_no", header: "الرقم", cell: ({ getValue }) => <span className="font-medium num">{getValue() as string}</span> },
    { accessorKey: "client_name", header: "العميل" },
    { accessorKey: "title", header: "المعاملة", cell: ({ getValue }) => <span className="line-clamp-1 max-w-64">{getValue() as string}</span> },
    { accessorKey: "status", header: "الحالة", cell: ({ getValue }) => <Badge tone={STATUS_TONE[getValue() as string]}>{TXN_STATUS_LABEL[getValue() as string]}</Badge> },
    { accessorKey: "payment_status", header: "الدفع", cell: ({ getValue }) => <Badge tone={STATUS_TONE[getValue() as string]}>{PAY_STATUS_LABEL[getValue() as string]}</Badge> },
    { accessorKey: "total", header: "الإجمالي", cell: ({ getValue }) => <span className="num">{money(getValue() as number)}</span> },
    { accessorKey: "remaining", header: "المتبقي", cell: ({ getValue }) => { const v = Number(getValue()); return <span className={v > 0 ? "text-bad num" : "text-ink-3 num"}>{money(v)}</span>; } },
    { accessorKey: "assignee_name", header: "الموظف", cell: ({ row }) => <span className="text-ink-2">{row.original.assignee_name ?? row.original.created_by_name ?? "—"}</span> },
    { accessorKey: "created_at", header: "التاريخ", cell: ({ getValue }) => <span className="text-ink-2 num">{fmtDate(getValue() as string)}</span> },
  ], []);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-4">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث فوري: رقم، عميل، أو عنوان المعاملة" className="ps-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة">
          <option value="">كل الحالات</option>
          {Object.entries(TXN_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={pay} onChange={(e) => setPay(e.target.value)} aria-label="حالة الدفع">
          <option value="">كل حالات الدفع</option>
          {Object.entries(PAY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={client} onChange={(e) => setClient(e.target.value)} aria-label="العميل">
          <option value="">كل العملاء</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="الموظف">
          <option value="">كل الموظفين</option>
          {staff.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-xs text-ink-3">من <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" className="text-start" /></label>
        <label className="flex items-center gap-2 text-xs text-ink-3">إلى <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="text-start" /></label>
      </div>
      <DataTable
        columns={columns} data={data} rowHref={(r) => `/transactions/${r.id}`} emptyTitle="لا توجد معاملات مطابقة"
        mobileCard={(r) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="text-xs text-ink-3">{r.client_name} · <span className="num">{r.ref_no}</span>{(r.assignee_name ?? r.created_by_name) ? ` · ${r.assignee_name ?? r.created_by_name}` : ""}</div>
              </div>
              <span className="text-sm font-semibold num">{money(r.total)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={STATUS_TONE[r.status]}>{TXN_STATUS_LABEL[r.status]}</Badge>
              <Badge tone={STATUS_TONE[r.payment_status]}>{PAY_STATUS_LABEL[r.payment_status]}</Badge>
              {r.remaining > 0 && <span className="text-xs text-bad">متبقي <span className="num">{money(r.remaining)}</span></span>}
            </div>
          </div>
        )}
      />
    </div>
  );
}
