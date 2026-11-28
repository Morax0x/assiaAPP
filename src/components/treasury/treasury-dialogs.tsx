"use client";
import { DateField } from "@/components/ui/date-field";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ClipboardCheck, PencilLine, Paperclip, Receipt } from "lucide-react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { ActionDialog } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { uploadPrivate } from "@/lib/upload";
import { addExpense, addTransfer, reconcile, setBalances } from "@/modules/treasury/actions";

type Acc = { id: string; name: string; balance?: number };
type Cat = { id: string; name: string };

export function ExpenseDialog({ accounts, categories, defaultOpen }: { accounts: Acc[]; categories: Cat[]; defaultOpen?: boolean }) {
  const [path, setPath] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [cat, setCat] = React.useState("");
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
      defaultOpen={defaultOpen} title="تسجيل مصروف تشغيلي" submitLabel="تسجيل المصروف" action={async (fd) => { const r = await addExpense(fd); if (r.ok) { setPath(""); setCat(""); } return r; }}
      trigger={<><Receipt /> تسجيل مصروف</>} triggerProps={{ variant: "primary" }}
    >
      <input type="hidden" name="receipt_path" value={path} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المبلغ"><Input name="amount" type="number" step="0.01" min="0.01" required dir="ltr" className="text-start" /></Field>
        <Field label="البند">
          <Select name="category_id" required value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="" disabled>اختر البند</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {!categories.some((c) => c.name.trim() === "رصيد") && <option value="new:رصيد">رصيد</option>}
            <option value="__new">بند آخر — أكتبه بنفسي</option>
          </Select>
          {cat === "__new" && <Input name="category_new" required minLength={2} maxLength={60} autoFocus placeholder="اكتب اسم البند" className="mt-2" />}
        </Field>
        <Field label="يُدفع من">
          <Select name="account_id" required>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        </Field>
        <Field label="التاريخ"><DateField name="occurred_at" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
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
        <Field label="تاريخ العملية"><DateField name="occurred_at" defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} /></Field>
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

/** Type the real cash / card amounts directly; the difference is recorded as an adjustment so nothing is lost from the history. */
export function BalancesDialog({ accounts }: { accounts: Acc[] }) {
  const [vals, setVals] = React.useState<Record<string, string>>({});
  return (
    <ActionDialog title="تعديل الرصيد" description="اكتب المبلغ الفعلي لكل حساب (كاش، بطاقة...). يُسجَّل الفرق كحركة تسوية ويبقى في السجل." submitLabel="حفظ الأرصدة" action={setBalances} trigger={<><PencilLine /> تعديل الرصيد</>}>
      <div className="space-y-3">
        {accounts.map((a) => {
          const v = vals[a.id] ?? "";
          const diff = v === "" ? null : Number(v) - (a.balance ?? 0);
          return (
            <Field key={a.id} label={`${a.name} — الحالي ${(a.balance ?? 0).toFixed(2)}`}>
              <Input name={`bal_${a.id}`} type="number" step="0.01" value={v} placeholder={(a.balance ?? 0).toFixed(2)} onChange={(e) => setVals((p) => ({ ...p, [a.id]: e.target.value }))} dir="ltr" className="text-start" />
              {diff !== null && diff !== 0 && <span className="mt-1 block text-xs text-warn">{diff > 0 ? "زيادة" : "نقص"} <span className="num">{Math.abs(diff).toFixed(2)}</span></span>}
            </Field>
          );
        })}
        <Field label="ملاحظة (اختياري)"><Input name="note" /></Field>
      </div>
    </ActionDialog>
  );
}
