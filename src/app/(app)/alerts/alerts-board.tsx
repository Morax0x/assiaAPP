"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck, FilePlus2, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Empty } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DocumentUploader, type DocType } from "@/components/documents/document-uploader";
import { DocumentPreviewButton } from "@/components/documents/document-preview";
import { createRenewalTransaction, setFollowup } from "@/modules/documents/actions";
import { BUCKET_LABEL, FOLLOWUP_LABEL } from "@/lib/permissions";
import { cn, daysLabel, fmtDate, waNumber } from "@/lib/utils";

export type AlertRow = {
  id: string; client_id: string; client_name: string; client_phone: string | null; client_whatsapp: string | null;
  type_id: string; type_name: string; title: string; expiry_date: string; days_left: number; bucket: string;
  followup: string; snoozed_until: string | null; notified_at: string | null;
};

const TABS = [
  { key: "all", label: "الكل" },
  { key: "expired", label: BUCKET_LABEL.expired },
  { key: "critical", label: BUCKET_LABEL.critical },
  { key: "upcoming", label: BUCKET_LABEL.upcoming },
  { key: "valid", label: BUCKET_LABEL.valid },
] as const;

export function AlertsBoard({ rows, template, types, canWrite, canTxn }: { rows: AlertRow[]; template: string; types: DocType[]; canWrite: boolean; canTxn: boolean }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<(typeof TABS)[number]["key"]>("all");
  const [renew, setRenew] = React.useState<AlertRow | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const isSnoozed = (r: AlertRow) => !!r.snoozed_until && r.snoozed_until > today;
  const counts = (k: string) => (k === "all" ? rows.length : rows.filter((r) => r.bucket === k).length);
  const list = rows.filter((r) => tab === "all" || r.bucket === tab);

  function waLink(r: AlertRow) {
    const msg = (template || "السلام عليكم {client}، {document} ينتهي بتاريخ {date}.")
      .replaceAll("{client}", r.client_name).replaceAll("{document}", `${r.type_name} (${r.title})`).replaceAll("{date}", fmtDate(r.expiry_date));
    return `https://wa.me/${waNumber(r.client_whatsapp || r.client_phone)}?text=${encodeURIComponent(msg)}`;
  }

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string } | { ok: true; data?: unknown } | { ok: false; error: string }>, ok = "تم") {
    setBusy(id);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return toast.error((r as { error: string }).error);
    toast.success(ok);
    router.refresh();
  }

  async function toRenewal(r: AlertRow) {
    setBusy(r.id);
    const res = await createRenewalTransaction(r.id);
    setBusy(null);
    if (!res.ok || !res.data) return toast.error(res.ok ? "تعذر الإنشاء" : res.error);
    router.push(`/transactions/${res.data.id}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-ctl border px-3 text-sm",
              tab === t.key ? "border-navy bg-navy text-white" : "border-line bg-surface text-ink-2 hover:bg-bg",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-[11px] num", tab === t.key ? "bg-white/20" : "bg-mute-soft")}>{counts(t.key)}</span>
          </button>
        ))}
      </div>

      <Card>
        {list.length === 0 ? (
          <Empty icon={<ShieldCheck />} title="لا توجد مستندات في هذا القسم" />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id} className={cn("px-4 py-3.5", isSnoozed(r) && "opacity-60")}>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/clients/${r.client_id}`} className="text-sm font-semibold hover:text-navy">{r.client_name}</Link>
                    <div className="mt-0.5 text-sm text-ink-2">{r.type_name} — {r.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                      <span>ينتهي <span className="num">{fmtDate(r.expiry_date)}</span></span>
                      <span>·</span>
                      <span>{FOLLOWUP_LABEL[r.followup]}{r.followup === "snoozed" && r.snoozed_until ? ` حتى ${fmtDate(r.snoozed_until)}` : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[r.bucket]}>{BUCKET_LABEL[r.bucket]}</Badge>
                    <span className={cn("min-w-20 text-end text-sm font-medium", r.days_left < 0 ? "text-bad" : r.days_left <= 14 ? "text-warn" : "text-ink-2")}>{daysLabel(r.days_left)}</span>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <DocumentPreviewButton id={r.id} />
                  {canWrite && <Button size="sm" variant="outline" onClick={() => setRenew(r)}><RefreshCw /> رفع النسخة المجددة</Button>}
                  {canTxn && <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => toRenewal(r)}><FilePlus2 /> معاملة تجديد</Button>}
                  <Button asChild size="sm" variant="outline"><a href={waLink(r)} target="_blank" rel="noreferrer"><MessageCircle /> واتساب</a></Button>
                  {canWrite && (
                    <>
                      <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => run(r.id, () => setFollowup(r.id, "client_notified"), "سُجّل إبلاغ العميل")}><CheckCheck /> تم إبلاغ العميل</Button>
                      <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => run(r.id, () => setFollowup(r.id, "snoozed", 7), "تم التأجيل 7 أيام")}><BellOff /> تأجيل 7 أيام</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!renew} onOpenChange={(o) => !o && setRenew(null)}>
        <DialogContent title="رفع النسخة المجددة" description={renew ? `${renew.client_name} — ${renew.title}` : undefined}>
          {renew && <DocumentUploader types={types} clientId={renew.client_id} renewOf={{ id: renew.id, typeId: renew.type_id }} onDone={() => setRenew(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
