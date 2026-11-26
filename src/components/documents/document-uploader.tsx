"use client";
import { DateField } from "@/components/ui/date-field";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import { Camera, FileUp, X, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { uploadPrivate } from "@/lib/upload";
import { createDocuments, renewDocument } from "@/modules/documents/actions";
import { cn } from "@/lib/utils";

export type DocType = { id: string; name: string };
export type ClientOpt = { id: string; name: string };

const MAX = 15 * 1024 * 1024;
const ACCEPT = { "application/pdf": [".pdf"], "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"], "application/msword": [".doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] };

async function prepare(file: File): Promise<File> {
  if (file.type.startsWith("image/") && file.type !== "image/gif") {
    try {
      return await imageCompression(file, { maxSizeMB: 0.9, maxWidthOrHeight: 1800, useWebWorker: true, initialQuality: 0.8 });
    } catch { return file; }
  }
  return file;
}

export function DocumentUploader({
  types, clients, clientId, transactionId, renewOf, onDone, defaultTypeId,
}: {
  types: DocType[];
  clients?: ClientOpt[];
  clientId?: string;
  transactionId?: string;
  renewOf?: { id: string; typeId: string };
  onDone?: () => void;
  defaultTypeId?: string;
}) {
  const router = useRouter();
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [client, setClient] = React.useState(clientId ?? "");
  const [typeId, setTypeId] = React.useState(renewOf?.typeId ?? defaultTypeId ?? types[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [issue, setIssue] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const single = !!renewOf;

  const add = React.useCallback((list: File[]) => {
    const ok = list.filter((f) => {
      if (f.size > MAX * 3) { toast.error(`${f.name}: الملف كبير جداً`); return false; }
      return true;
    });
    setFiles((p) => (single ? ok.slice(0, 1) : [...p, ...ok]));
  }, [single]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: add, accept: ACCEPT, multiple: !single, noClick: true, noKeyboard: true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return toast.error("اختر ملفاً واحداً على الأقل");
    if (!client) return toast.error("اختر العميل");
    if (renewOf && !expiry) return toast.error("أدخل تاريخ الانتهاء الجديد");
    setBusy(true);
    try {
      const rows: Parameters<typeof createDocuments>[0] = [];
      for (const f0 of files) {
        const f = await prepare(f0);
        if (f.size > MAX) throw new Error(`${f0.name}: يتجاوز 15 ميغابايت بعد الضغط`);
        const ext = (f0.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `clients/${client}/${crypto.randomUUID()}.${ext}`;
        try { await uploadPrivate(path, f, f.type || undefined); } catch (e) { throw new Error(`فشل رفع ${f0.name}: ${e instanceof Error ? e.message : ""}`); }
        rows.push({
          client_id: client,
          transaction_id: transactionId ?? null,
          type_id: typeId,
          title: (files.length === 1 && title.trim()) || f0.name.replace(/\.[^.]+$/, ""),
          issue_date: issue || null,
          expiry_date: expiry || null,
          storage_path: path,
          mime_type: f.type || "application/octet-stream",
          size_bytes: f.size,
        });
      }
      const r = renewOf
        ? await renewDocument({ old_id: renewOf.id, storage_path: rows[0].storage_path, mime_type: rows[0].mime_type, size_bytes: rows[0].size_bytes, issue_date: issue || null, expiry_date: expiry || null })
        : await createDocuments(rows);
      if (!r.ok) throw new Error(r.error);
      toast.success(renewOf ? "تم رفع النسخة المجددة وأرشفة القديمة" : `تم رفع ${rows.length} مستند`);
      setFiles([]); setTitle(""); setIssue(""); setExpiry("");
      router.refresh();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر الرفع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!clientId && clients && (
        <Field label="العميل">
          <Select value={client} onChange={(e) => setClient(e.target.value)} required>
            <option value="">اختر العميل</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      )}

      <div
        {...getRootProps()}
        className={cn(
          "rounded-card border border-dashed p-5 text-center transition-colors",
          isDragActive ? "border-navy bg-navy-soft" : "border-line-strong bg-bg",
        )}
      >
        <input {...getInputProps()} />
        <FileUp className="mx-auto mb-2 size-7 text-ink-3" strokeWidth={1.5} />
        <p className="text-sm text-ink-2">اسحب الملفات وأفلتها هنا</p>
        <p className="mt-0.5 text-xs text-ink-3">PDF، صور، مستندات — حتى 15 ميغابايت للملف، وتُضغط الصور تلقائياً</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={open}><FileUp /> اختيار ملفات</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}><Camera /> تصوير بالكاميرا</Button>
        </div>
        <input
          ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { if (e.target.files) add(Array.from(e.target.files)); e.target.value = ""; }}
        />
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-card border border-line">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              {f.type.startsWith("image/") ? <ImageIcon className="size-4 text-ink-3" strokeWidth={1.75} /> : <FileText className="size-4 text-ink-3" strokeWidth={1.75} />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-ink-3 num">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="rounded p-1 text-ink-3 hover:bg-mute-soft" aria-label="إزالة">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="تصنيف المستند">
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={!!renewOf}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        {files.length <= 1 && !renewOf && (
          <Field label="الاسم / الوصف" hint="اختياري، يؤخذ من اسم الملف">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        )}
        <Field label="تاريخ الإصدار">
          <DateField value={issue} onChange={setIssue} ariaLabel="تاريخ الإصدار" />
        </Field>
        <Field label={renewOf ? "تاريخ الانتهاء الجديد" : "تاريخ الانتهاء"} hint={renewOf ? undefined : "اختياري، يفعّل التنبيهات"}>
          <DateField value={expiry} onChange={setExpiry} required={!!renewOf} ariaLabel="تاريخ الانتهاء" />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !files.length}>{busy ? "جارٍ الرفع..." : renewOf ? "رفع النسخة المجددة" : "رفع المستندات"}</Button>
      </div>
    </form>
  );
}
