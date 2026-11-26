"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Folder, History, Plus, RefreshCw, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, STATUS_TONE } from "@/components/ui/badge";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { DocumentUploader, type DocType } from "@/components/documents/document-uploader";
import { DocumentPreviewButton } from "@/components/documents/document-preview";
import { DocumentEditDialog } from "@/components/documents/document-edit-dialog";
import { MoveDocumentsDialog, type MoveTarget } from "@/components/documents/move-documents-dialog";
import { deleteDocument } from "@/modules/documents/actions";
import { BUCKET_LABEL } from "@/lib/permissions";
import { daysLabel, fmtDate } from "@/lib/utils";

export type DocRow = {
  id: string; group_id: string; title: string; type_id: string; type_name: string;
  issue_date: string | null; expiry_date: string | null; is_current: boolean; created_at: string;
  transaction_id?: string | null; folder?: string | null; tag?: string | null;
};

function bucketOf(expiry: string | null, critical = 14) {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const bucket = days < 0 ? "expired" : days <= critical ? "critical" : days <= 90 ? "upcoming" : "valid";
  return { days, bucket };
}

export function DocumentsPanel({
  docs, types, clientId, transactionId, canWrite, canDelete, title = "المستندات", moveTargets,
}: {
  docs: DocRow[]; types: DocType[]; clientId: string; transactionId?: string;
  canWrite: boolean; canDelete: boolean; title?: string; moveTargets?: MoveTarget[];
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [renew, setRenew] = React.useState<DocRow | null>(null);
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  const current = docs.filter((d) => d.is_current);
  const history = (g: string) => docs.filter((d) => d.group_id === g && !d.is_current).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const canMove = canWrite && !!moveTargets?.length;

  // Keep the arrangement of imported folders: documents are shown inside their folder
  const folders = React.useMemo(() => {
    const m = new Map<string, DocRow[]>();
    current.forEach((d) => m.set(d.folder ?? "", [...(m.get(d.folder ?? "") ?? []), d]));
    return [...m.entries()].sort((a, b) => (a[0] === "" ? -1 : b[0] === "" ? 1 : a[0].localeCompare(b[0], "ar")));
  }, [current]);
  const showFolderHeads = folders.length > 1 || (folders[0] && folders[0][0] !== "");

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
      {canMove && picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-navy-soft px-4 py-2.5 text-sm">
          <span className="font-medium text-navy">محدد: <b className="num">{picked.size}</b></span>
          <MoveDocumentsDialog ids={[...picked]} currentClientId={clientId} targets={moveTargets!} onDone={() => setPicked(new Set())} label="نقل المحدد" />
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>إلغاء التحديد</Button>
        </div>
      )}
      {current.length === 0 ? (
        <Empty icon={<FileText />} title="لا توجد مستندات" hint="ارفع مستنداً أو صوّره بالكاميرا" />
      ) : (
        <div>
          {folders.map(([folder, list]) => (
            <div key={folder || "_root"}>
              {showFolderHeads && (
                <div className="flex items-center gap-2 border-y border-line bg-bg px-4 py-2 text-sm font-semibold text-ink-2 first:border-t-0">
                  <Folder className="size-4 text-navy" strokeWidth={1.75} /> {folder || "بدون مجلد"}
                  <span className="rounded-full bg-mute-soft px-2 text-xs num">{list.length}</span>
                  {canMove && (
                    <button type="button" className="ms-auto text-xs font-medium text-navy hover:underline" onClick={() => setPicked((s) => { const n = new Set(s); const all = list.every((d) => n.has(d.id)); list.forEach((d) => (all ? n.delete(d.id) : n.add(d.id))); return n; })}>تحديد المجلد</button>
                  )}
                </div>
              )}
              <ul className="divide-y divide-line">
                {list.map((d) => {
                  const b = bucketOf(d.expiry_date);
                  const old = history(d.group_id);
                  return (
                    <li key={d.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        {canMove && <input type="checkbox" checked={picked.has(d.id)} onChange={() => toggle(d.id)} className="size-5 accent-navy" aria-label="تحديد" />}
                        <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{d.title}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                            <span>{d.type_name}</span>
                            {d.expiry_date && <span>ينتهي <span className="num">{fmtDate(d.expiry_date)}</span></span>}
                            {d.tag && <span className="inline-flex items-center gap-1"><Tag className="size-3" />{d.tag}</span>}
                          </div>
                        </div>
                        {b && <Badge tone={STATUS_TONE[b.bucket]}>{BUCKET_LABEL[b.bucket]} · {daysLabel(b.days)}</Badge>}
                        <div className="flex flex-wrap items-center">
                          <DocumentPreviewButton id={d.id} />
                          {canWrite && <DocumentEditDialog canDelete={canDelete} doc={d} clientId={clientId} types={types} iconOnly folder={d.folder ?? ""} tag={d.tag ?? ""} />}
                          {canMove && <MoveDocumentsDialog ids={[d.id]} currentClientId={clientId} targets={moveTargets!} iconOnly />}
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
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!renew} onOpenChange={(o) => !o && setRenew(null)}>
        <DialogContent title="رفع النسخة المجددة" description="تُؤرشف النسخة القديمة في السجل ويُغلق التنبيه تلقائياً">
          {renew && <DocumentUploader types={types} clientId={clientId} transactionId={transactionId} renewOf={{ id: renew.id, typeId: renew.type_id }} onDone={() => setRenew(null)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
