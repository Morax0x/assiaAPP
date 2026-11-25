"use client";
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Search, User } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/utils";

type Row = { id: string; kind: string; name: string; phone: string | null; email: string | null; due: number };

export function ClientsTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = React.useState("");
  const [onlyDue, setOnlyDue] = React.useState(false);
  const data = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (!onlyDue || r.due > 0) && (!t || r.name.toLowerCase().includes(t) || (r.phone ?? "").includes(t) || (r.email ?? "").toLowerCase().includes(t)));
  }, [rows, q, onlyDue]);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: "name", header: "العميل",
      cell: ({ row }) => (
        <span className="flex items-center gap-2.5 font-medium">
          {row.original.kind === "company" ? <Building2 className="size-4 text-ink-3" strokeWidth={1.75} /> : <User className="size-4 text-ink-3" strokeWidth={1.75} />}
          {row.original.name}
        </span>
      ),
    },
    { accessorKey: "phone", header: "الهاتف", enableSorting: false, cell: ({ getValue }) => <span className="num text-ink-2">{(getValue() as string) || "—"}</span> },
    { accessorKey: "email", header: "البريد", enableSorting: false, cell: ({ getValue }) => <span className="text-ink-2">{(getValue() as string) || "—"}</span> },
    { accessorKey: "due", header: "المستحق عليه", cell: ({ getValue }) => { const v = getValue() as number; return v > 0 ? <Badge tone="bad"><span className="num">{money(v)}</span></Badge> : <span className="text-ink-3">—</span>; } },
  ], []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف" className="ps-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} className="size-4 accent-navy" />
          عليهم مستحقات فقط
        </label>
      </div>
      <DataTable
        columns={columns}
        data={data}
        rowHref={(r) => `/clients/${r.id}`}
        emptyTitle="لا يوجد عملاء مطابقون"
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                {r.kind === "company" ? <Building2 className="size-4 text-ink-3" strokeWidth={1.75} /> : <User className="size-4 text-ink-3" strokeWidth={1.75} />}
                <span className="truncate">{r.name}</span>
              </div>
              <div className="mt-1 text-xs text-ink-3 num">{r.phone || "—"}</div>
            </div>
            {r.due > 0 && <Badge tone="bad"><span className="num">{money(r.due)}</span></Badge>}
          </div>
        )}
      />
    </div>
  );
}
