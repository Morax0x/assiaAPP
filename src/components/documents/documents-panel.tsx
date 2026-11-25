"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, History, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DocumentUploader, type DocType } from "@/components/documents/document-uploader";
import { DocumentPreviewButton } from "@/components/documents/document-preview";
import { deleteDocument } from "@/modules/documents/actions";
import { BUCKET_LABEL } from "@/lib/permissions";
import { daysLabel, fmtDate } from "@/lib/utils";

export type DocRow = {
  id: string; group_id: string; title: string; type_id: string; type_name: string;
  issue_date: string | null; expiry_date: string | null; is_current: boolean; created_at: string;
};

function bucketOf(expiry: string | null, critical = 14) {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const bucket = days < 0 ? "expired" : days <= critical ? "critical" : days <= 90 ? "upcoming" : "valid";
  return { days, bucket };
}

export function DocumentsPanel({
  docs, types, clientId, transactionId, canWrite, canDelete, title = "المستندات",
}: {
  docs: DocRow[]; types: DocType[]; clientId: string; transactionId?: string;
  canWrite: boolean; canDelete: boolean; title?: string;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [renew, setRenew] = React.useState<DocRow | null>(null);
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);

  const current = docs.filter((d) => d.is_current);
  const history = (g: string) => docs.filter((d) => d.group_id === g && !d.is_current).sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Card>
      <CardHeader
        title={`${title} (${current.length})`}
        action={canWrite && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus /> رفع مستند</Button></DialogTrigger>
            <DialogContent title="رفع مستندات">
              <DocumentUploader types={types} clientId={clientId} transactionId={transactionId} onDone={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      />
      {current.length === 0 ? (
        <Empty icon={<FileText />} title="لا توجد مستندات" hint="ارفع مستنداً أو صوّره بالكاميرا" />
      ) : (
        <ul className="divide-y divide-line">
          {current.map((d) => {
            const b = bucketOf(d.expiry_date);
            const old = history(d.group_id);
            return (
              <li key={d.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{d.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                      <span>{d.type_name}</span>
                      {d.expiry_date && <span>ينتهي <span className="num">{fmtDate(d.expiry_date)}</span></span>}
                    </div>
                  </div>
                  {b && <Badge tone={STATUS_TONE[b.bucket]}>{BUCKET_LABEL[b.bucket]} · {daysLabel(b.days)}</Badge>}
                  <div className="flex items-center">
                    <DocumentPreviewButton id={d.id} />
                    {canWrite && d.expiry_date && (
                      <Button variant="ghost" size="sm" onClick={() => setRenew(d)}><RefreshCw /> تجديد</Button>
                    )}
                    {old.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setOpenGroup(openGroup === d.group_id ? null : d.group_id)}>
                        <History /> {old.length} <ChevronDown className={openGroup === d.group_id ? "rotate-180" : ""} />
                      </Button>
                    )}
                    {canDelete && (
                      <ConfirmButton
                        variant="ghost" size="icon" title="حذف المستند" message="سيُنقل المستند إلى المحذوفات ولن يظهر في القوائم."
                        action={() => deleteDocument(d.id)} confirmLabel="حذف" onDone={() => router.refresh()}
                      >
                        <Trash2 className="text-bad" />
                      </ConfirmButton>
                    )}
                  </div>
                </div>
                {openGroup === d.group_id && (
                  <ul className="mt-3 space-y-1 rounded-md bg-bg p-2 text-xs text-ink-2">
                    {old.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2">
                        <span>نسخة سابقة · انتهت <span className="num">{fmtDate(o.expiry_date)}</span></span>
                        <DocumentPreviewButton id={o.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={!!renew} onOpenChange={(o) => !o && setRenew(null)}>
        <DialogContent title="رفع النسخة المجددة" description="تُؤرشف النسخة القديمة في السجل ويُغلق التنبيه تلقائياً">
          {renew && <DocumentUploader types={types} clientId={clientId} transactionId={transactionId} renewOf={{ id: renew.id, typeId: renew.type_id }} onDone={() => setRenew(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
