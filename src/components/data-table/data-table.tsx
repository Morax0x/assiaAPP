"use client";
import * as React from "react";
import Link from "next/link";
import {
  flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/card";

export function DataTable<T>({
  columns, data, mobileCard, rowHref, pageSize = 15, emptyTitle = "لا توجد بيانات", emptyHint,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  mobileCard: (row: T) => React.ReactNode;
  rowHref?: (row: T) => string;
  pageSize?: number;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const table = useReactTable({
    data, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  const rows = table.getRowModel().rows;

  if (!data.length) {
    return <div className="rounded-card border border-line bg-surface"><Empty title={emptyTitle} hint={emptyHint} /></div>;
  }

  return (
    <div>
      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const inner = mobileCard(r.original);
          const href = rowHref?.(r.original);
          return href ? (
            <Link key={r.id} href={href} className="block rounded-card border border-line bg-surface p-3.5 active:bg-bg">{inner}</Link>
          ) : (
            <div key={r.id} className="rounded-card border border-line bg-surface p-3.5">{inner}</div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-bg text-xs text-ink-3">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort();
                  const dir = h.column.getIsSorted();
                  return (
                    <th key={h.id} className="px-4 py-2.5 text-start font-medium">
                      {h.isPlaceholder ? null : sortable ? (
                        <button className="inline-flex items-center gap-1 hover:text-ink" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === "asc" ? <ArrowUp className="size-3" /> : dir === "desc" ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const href = rowHref?.(r.original);
              return (
                <tr key={r.id} className={href ? "group relative hover:bg-bg" : ""}>
                  {r.getVisibleCells().map((c, i) => (
                    <td key={c.id} className="px-4 py-3 align-middle">
                      {i === 0 && href ? (
                        <Link href={href} className="after:absolute after:inset-0 hover:text-navy">{flexRender(c.column.columnDef.cell, c.getContext())}</Link>
                      ) : (
                        flexRender(c.column.columnDef.cell, c.getContext())
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-ink-3">
          <span className="num">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()} — {data.length} سجل</span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="التالي"><ChevronLeft /></Button>
            <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="السابق"><ChevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
