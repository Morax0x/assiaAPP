"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Ban, Paperclip, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Card, Empty } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { getReceiptUrl, voidEntry } from "@/modules/treasury/actions";
import { LEDGER_KIND_LABEL, METHOD_LABEL } from "@/lib/permissions";
import { fmtDateTime, money } from "@/lib/utils";

export type LedgerRow = {
  id: string; account_id: string; direction: "in" | "out"; kind: string; amount: number; method: string | null;
  occurred_at: string; description: string | null; receipt_path: string | null; voided_at: string | null;
  reference_no: string | null; paid_by: string | null;
  accounts: { name: string } | null; expense_categories: { name: string } | null; transactions: { id: string; ref_no: string; title: string } | null;
  clients: { id: string; name: string } | null; profiles: { full_name: string } | null;
};

export function LedgerList({ rows, accounts, canWrite }: { rows: LedgerRow[]; accounts: { id: string; name: string }[]; canWrite: boolean }) {
  const router = useRouter();
  const [acc, setAcc] = React.useState("");
  const [kind, setKind] = React.useState("");
  const list = rows.filter((r) => (!acc || r.account_id === acc) && (!kind || r.kind === kind));

  async function receipt(id: string) {
    const r = await getReceiptUrl(id);
    if (!r.ok || !r.data) return toast.error(r.ok ? "تعذر الفتح" : r.error);
    window.open(r.data.url, "_blank", "noopener");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={acc} onChange={(e) => setAcc(e.target.value)} className="w-auto min-w-40" aria-label="الحساب">
          <option value="">كل الحسابات</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto min-w-40" aria-label="النوع">
          <option value="">كل الحركات</option>
          {Object.entries(LEDGER_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <Card>
        {list.length === 0 ? <Empty title="لا توجد حركات" /> : (
          <ul className="divide-y divide-line">
            {list.map((r) => {
              const isIn = r.direction === "in";
              const label = r.kind === "expense" ? r.expense_categories?.name ?? "مصروف" : LEDGER_KIND_LABEL[r.kind];
              return (
                <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${r.voided_at ? "opacity-50" : ""}`}>
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${r.kind === "transfer" ? "bg-navy-soft text-navy" : isIn ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
                    {r.kind === "transfer" ? <ArrowLeftRight className="size-4" strokeWidth={1.75} /> : isIn ? <ArrowDownLeft className="size-4" strokeWidth={1.75} /> : <ArrowUpRight className="size-4" strokeWidth={1.75} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className={r.voided_at ? "line-through" : ""}>{label}</span>
                      {r.voided_at && <Badge tone="mute">ملغاة</Badge>}
                    </div>
                    <div className="truncate text-xs text-ink-3">
                      <span className="num">{fmtDateTime(r.occurred_at)}</span> · {r.accounts?.name}{r.method ? ` · ${METHOD_LABEL[r.method]}` : ""}
                      {r.reference_no ? ` · رقم ${r.reference_no}` : ""}{r.paid_by ? ` · ${r.paid_by}` : ""}{r.description ? ` · ${r.description}` : ""}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-3">
                      {r.clients && <Link href={`/clients/${r.clients.id}`} className="font-medium text-navy hover:underline">{r.clients.name}</Link>}
                      {r.transactions && <Link href={`/transactions/${r.transactions.id}`} className="num text-navy hover:underline">{r.transactions.ref_no}</Link>}
                      {r.profiles && <span>سجّلها {r.profiles.full_name}</span>}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold num ${r.kind === "transfer" ? "" : isIn ? "text-ok" : "text-bad"}`}>{isIn ? "+" : "−"}{money(r.amount)}</span>
                  {r.receipt_path && <Button size="icon" variant="ghost" onClick={() => receipt(r.id)} aria-label="الإيصال"><Paperclip /></Button>}
                  {canWrite && !r.voided_at && (
                    <ConfirmButton size="icon" variant="ghost" title="إلغاء الحركة" message={r.kind === "transfer" ? "سيُلغى طرفا التحويل معاً وتعود الأرصدة كما كانت." : "ستُلغى الحركة ويُعاد احتساب الرصيد. لا تُحذف من السجل."} action={() => voidEntry(r.id)} confirmLabel="إلغاء الحركة" onDone={() => router.refresh()}>
                      <Ban className="text-ink-3" />
                    </ConfirmButton>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
