"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { DateField } from "@/components/ui/date-field";
import { Field, Input, Select } from "@/components/ui/form";
import { CUSTOM_TYPE, DocTypePicker, type TypeOpt } from "@/components/documents/doc-type-picker";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ConvertToClientDialog } from "@/components/documents/convert-to-client-dialog";
import { deleteDocument, listClientTransactions, updateDocument } from "@/modules/documents/actions";

export type EditableDoc = { id: string; title: string; type_id: string; issue_date: string | null; expiry_date: string | null; transaction_id?: string | null };

/** Edit a document's name, type (or write a new type), dates, and linked transaction. */
export function DocumentEditDialog({ doc, clientId, types, iconOnly, folder: folder0 = "", tag: tag0 = "", canDelete = false, companies }: { doc: EditableDoc; clientId: string; types: TypeOpt[]; iconOnly?: boolean; folder?: string; tag?: string; canDelete?: boolean; companies?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(doc.title);
  const [typeId, setTypeId] = React.useState(doc.type_id || types[0]?.id || "");
  const [custom, setCustom] = React.useState("");
  const [issue, setIssue] = React.useState(doc.issue_date ?? "");
  const [expiry, setExpiry] = React.useState(doc.expiry_date ?? "");
  const [txn, setTxn] = React.useState(doc.transaction_id ?? "");
  const [txns, setTxns] = React.useState<{ id: string; label: string }[]>([]);
  const [folder, setFolder] = React.useState(folder0);
  const [tag, setTag] = React.useState(tag0);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    listClientTransactions(clientId).then((r) => { if (r.ok) setTxns(r.data ?? []); });
  }, [open, clientId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (typeId === CUSTOM_TYPE && custom.trim().length < 2) return toast.error("اكتب اسم النوع الجديد");
    setBusy(true);
    const r = await updateDocument(doc.id, {
      title, type_id: typeId === CUSTOM_TYPE ? null : typeId, custom_type: typeId === CUSTOM_TYPE ? custom : null,
      issue_date: issue || null, expiry_date: expiry || null, transaction_id: txn || null, folder: folder || null, tag: tag || null,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("تم حفظ التعديل");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size={iconOnly ? "icon" : "sm"} aria-label="تعديل المستند" title="تعديل المستند"><Pencil />{!iconOnly && " تعديل"}</Button>
      </DialogTrigger>
      <DialogContent title="تعديل المستند">
        <form onSubmit={save} className="space-y-4">
          <Field label="اسم المستند / الوصف"><Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <DocTypePicker types={types} typeId={typeId} custom={custom} onChange={(t, c) => { setTypeId(t); setCustom(c); }} />
            <Field label="تاريخ الإصدار"><DateField value={issue} onChange={setIssue} ariaLabel="تاريخ الإصدار" /></Field>
            <Field label="تاريخ الانتهاء" hint="اتركه فارغاً إن لم يكن له انتهاء"><DateField value={expiry} onChange={setExpiry} ariaLabel="تاريخ الانتهاء" /></Field>
            <Field label="المجلد" hint="مثال: الموظفين/أحمد. اتركه فارغاً لبدون مجلد"><Input value={folder} onChange={(e) => setFolder(e.target.value)} maxLength={300} /></Field>
            <Field label="التصنيف / المكان"><Input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={80} /></Field>
            <Field label="مرتبط بمعاملة" className="sm:col-span-2">
              <Select value={txn} onChange={(e) => setTxn(e.target.value)}>
                <option value="">بدون معاملة (ملف عام للعميل)</option>
                {txns.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
          </div>
          {companies && <div className="rounded-card border border-dashed border-line p-3 text-sm"><div className="mb-2 text-ink-3">هذا المستند يخص عميلاً آخر أو يستحق ملفاً خاصاً به؟</div><ConvertToClientDialog ids={[doc.id]} defaultName={doc.title} companies={companies} label="حوّله إلى ملف عميل جديد" onDone={() => setOpen(false)} /></div>}
          <div className="flex items-center justify-between gap-2">
            {canDelete ? (
              <ConfirmButton type="button" variant="danger" title="حذف المستند" confirmLabel="احذف" message={`سيُحذف «${doc.title}» وينتقل إلى سلة المحذوفات، ويمكن استرجاعه منها.`}
                action={async () => { const r = await deleteDocument(doc.id); if (r.ok) setOpen(false); return r; }}><Trash2 /> حذف المستند</ConfirmButton>
            ) : <span />}
            <Button type="submit" disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ التعديل"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
