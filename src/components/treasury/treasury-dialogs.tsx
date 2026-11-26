"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ClipboardCheck, Paperclip, Receipt } from "lucide-react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { ActionDialog } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { uploadPrivate } from "@/lib/upload";
import { addExpense, addTransfer, reconcile } from "@/modules/treasury/actions";

type Acc = { id: string; name: string; balance?: number };
type Cat = { id: string; name: string };

export function ExpenseDialog({ accounts, categories, defaultOpen }: { accounts: Acc[]; categories: Cat[]; defaultOpen?: boolean }) {
  const [path, setPath] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const router = useRouter();

  async function upload(file: File) {
    setUploading(true);
    try {
      const f = file.type.startsWith("image/") ? await imageCompression(file, { maxSizeMB: 0.7, maxWidthOrHeight: 1600, useWebWorker: true }) : file;
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const p = `expenses/${crypto.randomUUID()}.${ext}`;
      await uploadPrivate(p, f, f.type || undefined);
      setPath(p);
      toast.success("تم إرفاق الصورة");
    } catch { toast.error("تعذر رفع الصورة"); } finally { setUploading(false); }
  }

  return (
    <ActionDialog
      defaultOpen={defaultOpen} title="تسجيل مصروف تشغيلي" submitLabel="تسجيل المصروف" action={async (fd) => { const r = await addExpense(fd); if (r.ok) setPath(""); return r; }}
      trigger={<><Receipt /> تسجيل مصروف</>} triggerProps={{ variant: "primary" }}
    >
      <input type="hidden" name="receipt_path" value={path} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المبلغ"><Input name="amount" type="number" step="0.01" min="0.01" required dir="ltr" className="text-start" /></Field>
        <Field label="البند">
          <Select name="category_id" required defaultValue="">
            <option value="" disabled>اختر البند</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="يُدفع من">
          <Select name="account_id" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        </Field>
        <Field label="التاريخ"><Input name="occurred_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} dir="ltr" className="text-start" /></Field>
        <Field label="الوصف" className="sm:col-span-2"><Textarea name="description" className="min-h-16" /></Field>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-ctl border border-dashed border-line-strong bg-bg px-3 py-3 text-sm text-ink-2">
            <Paperclip className="size-4" strokeWidth={1.75} />
            {uploading ? "جارٍ الرفع..." : path ? "تم إرفاق صورة الفاتورة (اضغط للتغيير)" : "إرفاق صورة الفاتورة / تصوير بالكاميرا"}
            <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f).then(() => router.refresh()); }} />
          </label>
        </div>
      </div>
    </ActionDialog>
  );
}

export function TransferDialog({ accounts }: { accounts: Acc[] }) {
  return (
    <ActionDialog title="نقل مبلغ بين الكاش والبطاقة" description="مثلاً: إيداع الكاش في البنك أو سحب من البطاقة. لا يُحتسب ربحاً ولا مصروفاً." submitLabel="تحويل" action={addTransfer} trigger={<><ArrowLeftRight /> نقل بين الحسابات</>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="من"><Select name="from" defaultValue={accounts[0]?.id}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="إلى"><Select name="to" defaultValue={accounts[1]?.id ?? accounts[0]?.id}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="المبلغ"><Input name="amount" type="number" step="0.01" min="0.01" required dir="ltr" className="text-start" /></Field>
        <Field label="تاريخ العملية"><Input name="occurred_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} dir="ltr" className="text-start" /></Field>
        <Field label="رقم العملية / الإيصال (اختياري)"><Input name="reference_no" dir="ltr" className="text-start" /></Field>
        <Field label="ملاحظة"><Input name="note" placeholder="إيداع / سحب" /></Field>
      </div>
    </ActionDialog>
  );
}

export function ReconcileDialog({ accounts }: { accounts: Acc[] }) {
  const [id, setId] = React.useState(accounts[0]?.id ?? "");
  const sys = accounts.find((a) => a.id === id)?.balance ?? 0;
  const [actual, setActual] = React.useState("");
  const diff = actual === "" ? null : Number(actual) - sys;
  return (
    <ActionDialog title="جرد الصندوق" description="عدّ الفلوس الموجودة أمامك واكتب المبلغ، وسأقارنه بالرصيد المسجل." submitLabel="تسجيل المطابقة" action={reconcile} trigger={<><ClipboardCheck /> جرد الصندوق</>}>
      <div className="space-y-3">
        <Field label="الحساب"><Select name="account_id" value={id} onChange={(e) => setId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <div className="flex items-center justify-between rounded-md bg-bg px-3 py-2 text-sm">
          <span className="text-ink-2">الرصيد في النظام</span><span className="font-semibold num">{sys.toFixed(2)}</span>
        </div>
        <Field label="الرصيد الفعلي الموجود"><Input name="actual" type="number" step="0.01" min="0" required value={actual} onChange={(e) => setActual(e.target.value)} dir="ltr" className="text-start" /></Field>
        {diff !== null && (
          <div className={`rounded-md px-3 py-2 text-sm ${diff === 0 ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
            {diff === 0 ? "الرصيد مطابق" : <>الفرق: <span className="font-semibold num">{diff.toFixed(2)}</span> ({diff > 0 ? "زيادة" : "عجز"})</>}
          </div>
        )}
        <Field label="ملاحظة"><Input name="note" /></Field>
        <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" name="adjust" className="size-4 accent-navy" /> تسجيل الفرق كحركة تسوية وتعديل الرصيد</label>
      </div>
    </ActionDialog>
  );
}
