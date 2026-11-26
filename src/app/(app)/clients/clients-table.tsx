"use client";
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Search, ShieldCheck, User } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { money, cn } from "@/lib/utils";
import { CLIENT_KIND_PLURAL } from "@/lib/permissions";

const KindIcon = ({ kind, className }: { kind: string; className?: string }) =>
  kind === "company" ? <Building2 className={className} strokeWidth={1.75} /> : kind === "sponsor" ? <ShieldCheck className={className} strokeWidth={1.75} /> : <User className={className} strokeWidth={1.75} />;

type Row = { id: string; kind: string; name: string; phone: string | null; email: string | null; due: number };

export function ClientsTable({ rows }: { rows: Row[] }) {
  const [q, setQ] = React.useState("");
  const [onlyDue, setOnlyDue] = React.useState(false);
  const [kind, setKind] = React.useState("");
  const count = (k: string) => (k ? rows.filter((r) => r.kind === k).length : rows.length);
  const data = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (!kind || r.kind === kind) && (!onlyDue || r.due > 0) && (!t || r.name.toLowerCase().includes(t) || (r.phone ?? "").includes(t) || (r.email ?? "").toLowerCase().includes(t)));
  }, [rows, q, onlyDue, kind]);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(() => [
    {
      accessorKey: "name", header: "العميل",
      cell: ({ row }) => (
        <span className="flex items-center gap-2.5 font-medium">
          <KindIcon kind={row.original.kind} className="size-4 text-ink-3" />
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
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {([["", "الكل"], ["individual", CLIENT_KIND_PLURAL.individual], ["company", CLIENT_KIND_PLURAL.company], ["sponsor", CLIENT_KIND_PLURAL.sponsor]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)} className={cn("flex h-10 shrink-0 items-center gap-2 rounded-ctl border px-4 text-[15px] font-medium", kind === k ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink-2 hover:bg-bg")}>
            {label}<span className={cn("rounded-full px-2 text-xs num", kind === k ? "bg-white/20" : "bg-mute-soft")}>{count(k)}</span>
          </button>
        ))}
      </div>
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
                <KindIcon kind={r.kind} className="size-4 text-ink-3" />
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
