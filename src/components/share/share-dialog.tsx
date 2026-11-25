"use client";
import * as React from "react";
import { Check, Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { createShareLink } from "@/modules/share/actions";
import { waNumber } from "@/lib/utils";

export type ShareDoc = { id: string; title: string };

export function ShareDialog({
  scope, clientId, transactionId, documents, phone, label = "مشاركة",
}: {
  scope: "transaction" | "client_folder" | "documents";
  clientId?: string;
  transactionId?: string;
  documents?: ShareDoc[];
  phone?: string | null;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [days, setDays] = React.useState("7");
  const [pin, setPin] = React.useState("");
  const [download, setDownload] = React.useState(true);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function create() {
    setBusy(true);
    const r = await createShareLink({
      scope, client_id: clientId ?? null, transaction_id: transactionId ?? null,
      document_ids: scope === "documents" ? picked : undefined,
      days: Number(days), pin: pin || undefined, allow_download: download,
    });
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.ok ? "تعذر الإنشاء" : r.error);
    setUrl(r.data.url);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { toast.error("تعذر النسخ"); }
  }

  const wa = phone
    ? `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(`السلام عليكم، هذا رابط مستنداتكم:\n${url}${pin ? `\nالرمز السري: ${pin}` : ""}`)}`
    : `https://wa.me/?text=${encodeURIComponent(url)}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setUrl(""); setPin(""); } }}>
      <DialogTrigger asChild><Button variant="outline"><Share2 /> {label}</Button></DialogTrigger>
      <DialogContent title="رابط مشاركة خارجي" description="يفتح بدون تسجيل دخول، للقراءة فقط، ولا يعرض أي بيانات مالية داخلية">
        {!url ? (
          <div className="space-y-4">
            {scope === "documents" && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-card border border-line p-2">
                {(documents ?? []).map((d) => (
                  <label key={d.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-bg">
                    <input type="checkbox" className="size-4 accent-navy" checked={picked.includes(d.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id)))} />
                    {d.title}
                  </label>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="مدة الصلاحية">
                <Select value={days} onChange={(e) => setDays(e.target.value)}>
                  <option value="1">24 ساعة</option>
                  <option value="3">3 أيام</option>
                  <option value="7">7 أيام</option>
                  <option value="30">30 يوماً</option>
                </Select>
              </Field>
              <Field label="رمز سري (PIN)" hint="اختياري، 4 إلى 8 أرقام">
                <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={8} dir="ltr" className="text-start" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" className="size-4 accent-navy" checked={download} onChange={(e) => setDownload(e.target.checked)} />
              السماح بتحميل الملفات
            </label>
            <div className="flex justify-end">
              <Button onClick={create} disabled={busy || (scope === "documents" && !picked.length)}>{busy ? "..." : "إنشاء الرابط"}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-ink-3">انسخ الرابط الآن، لن يظهر مرة أخرى (يمكنك إلغاؤه من الإعدادات).</p>
            <Input readOnly value={url} dir="ltr" className="text-start text-xs" onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? "تم النسخ" : "نسخ"}</Button>
              <Button asChild variant="accent"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> إرسال واتساب</a></Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
