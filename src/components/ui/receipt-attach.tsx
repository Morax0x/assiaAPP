"use client";
import * as React from "react";
import { Camera, CheckCircle2, Paperclip, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { uploadPrivate } from "@/lib/upload";

/** Attach a photo/PDF of a receipt. Uploads to the private vault and gives the path through a hidden input. */
export function ReceiptAttach({ name = "receipt_path", label = "إرفاق صورة الإيصال (اختياري)" }: { name?: string; label?: string }) {
  const [path, setPath] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const camRef = React.useRef<HTMLInputElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const f = file.type.startsWith("image/") ? await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true }) : file;
      if (f.size > 10 * 1024 * 1024) throw new Error("الملف كبير (الحد 10 ميغابايت)");
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const p = `receipts/${crypto.randomUUID()}.${ext}`;
      await uploadPrivate(p, f, f.type || undefined);
      setPath(p); setFileName(file.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر رفع الإيصال");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <input type="hidden" name={name} value={path} />
      {path ? (
        <div className="flex items-center gap-2 rounded-ctl border border-ok/40 bg-ok-soft px-3 py-2.5 text-sm text-ok">
          <CheckCircle2 className="size-5 shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate">تم إرفاق: {fileName}</span>
          <button type="button" onClick={() => { setPath(""); setFileName(""); }} className="rounded p-1 hover:bg-ok/10" aria-label="إزالة"><X className="size-4" /></button>
        </div>
      ) : (
        <div className="rounded-ctl border border-dashed border-line-strong bg-bg p-3">
          <div className="mb-2 flex items-center gap-2 text-sm text-ink-2"><Paperclip className="size-4" strokeWidth={1.75} />{busy ? "جارٍ الرفع..." : label}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => camRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-ctl border border-line-strong bg-surface px-3 text-sm hover:bg-bg"><Camera className="size-4" strokeWidth={1.75} /> تصوير بالكاميرا</button>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-ctl border border-line-strong bg-surface px-3 text-sm hover:bg-bg"><Paperclip className="size-4" strokeWidth={1.75} /> اختيار ملف</button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        </div>
      )}
    </div>
  );
}
