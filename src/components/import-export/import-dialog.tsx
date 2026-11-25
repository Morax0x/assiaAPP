"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { importTransactions, type ImportRow } from "@/modules/import-export/actions";

const ALIAS: Record<keyof ImportRow, string[]> = {
  client: ["العميل", "اسم العميل", "client", "client_name"],
  title: ["المعاملة", "العنوان", "عنوان المعاملة", "الخدمة", "title", "service"],
  govt_fees: ["الرسوم الحكومية", "الرسوم", "govt_fees", "gov_fees", "fees"],
  office_fee: ["أتعاب المكتب", "الأتعاب", "office_fee", "profit"],
  discount: ["الخصم", "خصم", "discount"],
  status: ["الحالة", "status"],
  due_date: ["تاريخ الاستحقاق", "تاريخ التسليم", "due_date", "date"],
};
const STATUS_MAP: Record<string, ImportRow["status"]> = {
  "جديدة": "new", "جديد": "new", new: "new", "قيد الإجراء": "in_progress", in_progress: "in_progress",
  "بانتظار مستندات": "awaiting_docs", awaiting_docs: "awaiting_docs", "مكتملة": "completed", "مكتمل": "completed", completed: "completed",
  "ملغاة": "cancelled", cancelled: "cancelled",
};

function pick(row: Record<string, unknown>, key: keyof ImportRow) {
  const norm = (s: string) => s.trim().toLowerCase();
  const k = Object.keys(row).find((h) => ALIAS[key].some((a) => norm(a) === norm(h)));
  return k ? row[k] : undefined;
}
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
function dateStr(v: unknown) {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function ImportDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function onFile(f: File) {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const parsed: ImportRow[] = raw
        .map((r) => ({
          client: String(pick(r, "client") ?? "").trim(),
          title: String(pick(r, "title") ?? "").trim(),
          govt_fees: num(pick(r, "govt_fees")), office_fee: num(pick(r, "office_fee")), discount: num(pick(r, "discount")),
          status: STATUS_MAP[String(pick(r, "status") ?? "").trim().toLowerCase()] ?? "new",
          due_date: dateStr(pick(r, "due_date")),
        }))
        .filter((r) => r.client || r.title);
      if (!parsed.length) return toast.error("لم أجد صفوفاً صالحة. تأكد من أسماء الأعمدة (حمّل النموذج).");
      setRows(parsed); setFileName(f.name);
    } catch { toast.error("تعذر قراءة الملف"); }
  }

  function template() {
    const ws = XLSX.utils.json_to_sheet([{ "العميل": "اسم العميل", "المعاملة": "تجديد رخصة تجارية", "الرسوم الحكومية": 1500, "أتعاب المكتب": 300, "الخصم": 0, "الحالة": "جديدة", "تاريخ الاستحقاق": "2026-12-31" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نموذج");
    XLSX.writeFile(wb, "نموذج-استيراد-المعاملات.xlsx");
  }

  async function submit() {
    setBusy(true);
    const r = await importTransactions(rows);
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.ok ? "تعذر الاستيراد" : r.error);
    toast.success(`تم استيراد ${r.data.created} معاملة، وأُنشئ ${r.data.clients} عميل جديد`);
    setRows([]); setFileName(""); setOpen(false); router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Upload /> استيراد</Button></DialogTrigger>
      <DialogContent title="استيراد معاملات من Excel / CSV" description="العميل غير الموجود يُنشأ تلقائياً، والاسم المطابق يُربط بالموجود" className="md:max-w-2xl">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-ctl border border-line-strong bg-surface px-4 text-sm hover:bg-bg">
              <FileSpreadsheet className="size-4" strokeWidth={1.75} /> اختيار ملف
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            </label>
            <Button variant="ghost" onClick={template}>تحميل النموذج</Button>
          </div>
          {rows.length > 0 && (
            <>
              <p className="text-sm text-ink-2">{fileName}: <span className="font-semibold num">{rows.length}</span> صف جاهز للاستيراد</p>
              <div className="max-h-56 overflow-auto rounded-card border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-bg text-ink-3"><tr><th className="p-2 text-start">العميل</th><th className="p-2 text-start">المعاملة</th><th className="p-2 text-start">الرسوم</th><th className="p-2 text-start">الأتعاب</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {rows.slice(0, 8).map((r, i) => <tr key={i}><td className="p-2">{r.client}</td><td className="p-2">{r.title}</td><td className="p-2 num">{r.govt_fees}</td><td className="p-2 num">{r.office_fee}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end"><Button onClick={submit} disabled={busy}>{busy ? "جارٍ الاستيراد..." : `استيراد ${rows.length} معاملة`}</Button></div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
