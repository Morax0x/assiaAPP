"use client";
import { DateField } from "@/components/ui/date-field";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import imageCompression from "browser-image-compression";
import { Camera, FileUp, ScanText, X, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { ClientPicker } from "@/components/ui/client-picker";
import { uploadPrivate } from "@/lib/upload";
import { MAX_FILE_BYTES, readableKey } from "@/lib/keys";
import { CUSTOM_TYPE, DocTypePicker } from "@/components/documents/doc-type-picker";
import { createDocuments, renewDocument } from "@/modules/documents/actions";
import { cn } from "@/lib/utils";

export type DocType = { id: string; name: string };
export type ClientOpt = { id: string; name: string; kind?: string };

const MAX = MAX_FILE_BYTES;
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
  types, clients, clientId, clientInfo, transactionId, renewOf, onDone, defaultTypeId, folder,
}: {
  folder?: string;
  types: DocType[];
  clients?: ClientOpt[];
  clientId?: string;
  clientInfo?: ClientOpt;
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
  const [customType, setCustomType] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [issue, setIssue] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const single = !!renewOf;
  const [reading, setReading] = React.useState<number | null>(null);

  const add = React.useCallback((list: File[]) => {
    const ok = list.filter((f) => {
      if (f.size === 0) { toast.error(`${f.name}: الملف فارغ (0 بايت) ولا يمكن رفعه`); return false; }
      if (f.size > MAX * 3) { toast.error(`${f.name}: الملف كبير جداً`); return false; }
      return true;
    });
    setFiles((p) => (single ? ok.slice(0, 1) : [...p, ...ok]));
  }, [single]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: add, accept: ACCEPT, multiple: !single, noClick: true, noKeyboard: true,
  });

  async function autoRead() {
    const f = files[0];
    if (!f) return;
    if (!(f.type.startsWith("image/") || f.type === "application/pdf") || /heic/i.test(f.type)) return toast.error("القراءة التلقائية تعمل مع الصور وملفات PDF فقط");
    setReading(0);
    try {
      const { readDocument, guessTypeId } = await import("@/lib/ocr-doc");
      const r = await readDocument(f, (p) => setReading(Math.round(p * 100)));
      console.debug("[ocr] text:", r.text);
      const guess = guessTypeId(r.text, types);
      if (guess && !renewOf) { setTypeId(guess); setCustomType(""); }
      if (r.issue) setIssue(r.issue);
      if (r.expiry) setExpiry(r.expiry);
      const found = [guess && !renewOf ? "النوع" : "", r.issue ? "تاريخ الإصدار" : "", r.expiry ? "تاريخ الانتهاء" : ""].filter(Boolean);
      if (found.length) toast.success(`تمت قراءة: ${found.join(" + ")}`);
      else toast.warning("لم أستطع قراءة بيانات واضحة. أدخلها يدوياً، أو جرّب صورة أوضح");
    } catch (e) {
      console.error("[ocr]", e);
      toast.error(`تعذرت القراءة التلقائية${e instanceof Error && e.message ? `: ${e.message}` : ""}`);
    } finally {
      setReading(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return toast.error("اختر ملفاً واحداً على الأقل");
    if (!client) return toast.error("اختر العميل");
    if (renewOf && !expiry) return toast.error("أدخل تاريخ الانتهاء الجديد");
    if (typeId === CUSTOM_TYPE && customType.trim().length < 2) return toast.error("اكتب اسم النوع الجديد");
    setBusy(true);
    try {
      const rows: Parameters<typeof createDocuments>[0] = [];
      for (const f0 of files) {
        const f = await prepare(f0);
        if (f.size > MAX) throw new Error(`${f0.name}: يتجاوز 25 ميغابايت بعد الضغط`);
        const ext = (f0.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `clients/${client}/${crypto.randomUUID()}.${ext}`;
        const ci = [...(clients ?? []), ...(clientInfo ? [clientInfo] : [])].find((c) => c.id === client);
        const readable = ci?.kind ? readableKey({ kind: ci.kind, name: ci.name, fileName: f0.name }) : undefined;
        let stored = path;
        try { stored = await uploadPrivate(path, f, f.type || undefined, readable); } catch (e) { throw new Error(`فشل رفع ${f0.name}: ${e instanceof Error ? e.message : ""}`); }
        rows.push({
          client_id: client,
          transaction_id: transactionId ?? null,
          type_id: typeId === CUSTOM_TYPE ? null : typeId,
          custom_type: typeId === CUSTOM_TYPE ? customType : null,
          title: (files.length === 1 && title.trim()) || f0.name.replace(/\.[^.]+$/, ""),
          issue_date: issue || null,
          expiry_date: expiry || null,
          storage_path: stored,
          mime_type: f.type || "application/octet-stream",
          size_bytes: f.size,
          folder: folder || null,
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
      {folder && <p className="rounded-ctl bg-navy-soft px-3 py-2 text-sm text-navy">سيُحفظ داخل المجلد: <b dir="auto">{folder.split("/").join(" › ")}</b></p>}
      {!clientId && clients && (
        <Field label="العميل">
          <ClientPicker clients={clients} value={client} onChange={setClient} />
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
        <p className="mt-0.5 text-xs text-ink-3">PDF، صور، مستندات — حتى 25 ميغابايت للملف، وتُضغط الصور تلقائياً</p>
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

      {files.length === 1 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-line px-3 py-2.5">
          <Button type="button" variant="outline" size="sm" onClick={autoRead} disabled={reading !== null || busy}>
            <ScanText /> {reading !== null ? `جارٍ القراءة ${reading}%` : "قراءة تلقائية للنوع والتواريخ"}
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <DocTypePicker types={types} typeId={typeId} custom={customType} onChange={(t, c) => { setTypeId(t); setCustomType(c); }} disabled={!!renewOf} label="تصنيف المستند" />
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
