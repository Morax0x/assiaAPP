"use client";
import * as React from "react";
import { ChevronDown, ListPlus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/form";
import { money } from "@/lib/utils";

export type ServiceOpt = {
  id: string; name: string; name_en: string | null; category: string | null;
  default_govt_fee: number; default_office_fee: number;
};
export type ItemInit = {
  service_id?: string | null; description: string; description_en?: string | null;
  qty?: number | string; govt_unit?: number | string; fee_unit?: number | string; item_date?: string | null;
};
type Row = { key: number; service_id: string; description: string; description_en: string; qty: string; govt_unit: string; fee_unit: string; item_date: string; en: boolean };
export type Totals = { govt: number; fee: number; total: number };

let seq = 1;
const num = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const blank = (): Row => ({ key: seq++, service_id: "", description: "", description_en: "", qty: "1", govt_unit: "", fee_unit: "", item_date: "", en: false });
const fromInit = (i: ItemInit): Row => ({
  key: seq++, service_id: i.service_id ?? "", description: i.description, description_en: i.description_en ?? "",
  qty: String(i.qty ?? 1), govt_unit: i.govt_unit ? String(i.govt_unit) : "", fee_unit: i.fee_unit ? String(i.fee_unit) : "",
  item_date: i.item_date ?? "", en: !!i.description_en,
});

/**
 * Line items of an invoice / quotation. Each line can come from the services list (name and prices fill in
 * automatically) or be typed by hand. Government fees are pass-through cost; office fees are the profit.
 */
export function ItemsEditor({
  services, initial, name = "items_json", onTotals,
}: { services: ServiceOpt[]; initial?: ItemInit[]; name?: string; onTotals?: (t: Totals) => void }) {
  const [rows, setRows] = React.useState<Row[]>(() => (initial?.length ? initial.map(fromInit) : [blank()]));
  const listId = React.useId();

  const totals = React.useMemo<Totals>(() => {
    const govt = rows.reduce((a, r) => a + num(r.qty) * num(r.govt_unit), 0);
    const fee = rows.reduce((a, r) => a + num(r.qty) * num(r.fee_unit), 0);
    return { govt, fee, total: govt + fee };
  }, [rows]);
  React.useEffect(() => { onTotals?.(totals); }, [totals, onTotals]);

  const json = JSON.stringify(rows.map((r) => ({
    service_id: r.service_id || null, description: r.description, description_en: r.description_en,
    qty: r.qty || "1", govt_unit: r.govt_unit || "0", fee_unit: r.fee_unit || "0", item_date: r.item_date || null,
  })));

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const byName = React.useMemo(() => new Map(services.map((s) => [s.name.trim(), s])), [services]);

  function onDescription(r: Row, value: string) {
    const s = byName.get(value.trim());
    if (s) {
      patch(r.key, {
        description: s.name, service_id: s.id, description_en: s.name_en ?? r.description_en, en: r.en || !!s.name_en,
        govt_unit: r.govt_unit || (s.default_govt_fee ? String(s.default_govt_fee) : ""),
        fee_unit: r.fee_unit || (s.default_office_fee ? String(s.default_office_fee) : ""),
      });
    } else patch(r.key, { description: value, service_id: "" });
  }

  function addFromCatalog(id: string) {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    const row: Row = {
      ...blank(), service_id: s.id, description: s.name, description_en: s.name_en ?? "", en: !!s.name_en,
      govt_unit: s.default_govt_fee ? String(s.default_govt_fee) : "", fee_unit: s.default_office_fee ? String(s.default_office_fee) : "",
    };
    setRows((rs) => (rs.length === 1 && !rs[0].description && !num(rs[0].govt_unit) && !num(rs[0].fee_unit) ? [row] : [...rs, row]));
  }

  const grouped = React.useMemo(() => {
    const m = new Map<string, ServiceOpt[]>();
    services.forEach((s) => m.set(s.category ?? "خدمات أخرى", [...(m.get(s.category ?? "خدمات أخرى") ?? []), s]));
    return [...m.entries()];
  }, [services]);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={json} />
      <datalist id={listId}>{services.map((s) => <option key={s.id} value={s.name} />)}</datalist>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <ListPlus className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-navy" strokeWidth={1.75} />
          <select
            value="" onChange={(e) => addFromCatalog(e.target.value)} aria-label="إضافة من قائمة الخدمات"
            className="h-11 w-full rounded-ctl border border-navy/40 bg-navy-soft ps-10 pe-3 text-[15px] font-medium text-navy"
          >
            <option value="">إضافة خدمة من القائمة (الأسعار تمتلئ تلقائياً)</option>
            {grouped.map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((s) => <option key={s.id} value={s.id}>{s.name}{s.default_govt_fee + s.default_office_fee > 0 ? ` — ${money(s.default_govt_fee + s.default_office_fee, "")}` : ""}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => setRows((rs) => [...rs, blank()])} className="inline-flex h-11 items-center justify-center gap-2 rounded-ctl border border-line-strong bg-surface px-4 text-[15px] font-medium hover:bg-bg">
          <Plus className="size-4" strokeWidth={2} /> بند يدوي
        </button>
      </div>

      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.key} className="rounded-card border border-line bg-surface p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-mute-soft text-xs font-bold text-ink-2">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Input
                  list={listId} value={r.description} onChange={(e) => onDescription(r, e.target.value)}
                  placeholder="اسم الخدمة أو البند (اكتب أو اختر من القائمة)" aria-label="وصف البند"
                />
              </div>
              {rows.length > 1 && (
                <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-ctl text-bad hover:bg-bad-soft" aria-label="حذف البند">
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 ps-8">
              <label className="space-y-1"><span className="text-xs text-ink-3">الكمية</span>
                <Input type="number" min="0.01" step="0.01" value={r.qty} onChange={(e) => patch(r.key, { qty: e.target.value })} dir="ltr" className="text-start" inputMode="decimal" />
              </label>
              <label className="space-y-1"><span className="text-xs text-ink-3">رسوم حكومية</span>
                <Input type="number" min="0" step="0.01" value={r.govt_unit} onChange={(e) => patch(r.key, { govt_unit: e.target.value })} placeholder="0" dir="ltr" className="text-start" inputMode="decimal" />
              </label>
              <label className="space-y-1"><span className="text-xs text-ink-3">أتعاب المكتب</span>
                <Input type="number" min="0" step="0.01" value={r.fee_unit} onChange={(e) => patch(r.key, { fee_unit: e.target.value })} placeholder="0" dir="ltr" className="text-start" inputMode="decimal" />
              </label>
            </div>
            <div className="mt-2 flex items-center justify-between ps-8">
              <button type="button" onClick={() => patch(r.key, { en: !r.en })} className="inline-flex items-center gap-1 text-xs font-medium text-navy hover:underline">
                <ChevronDown className={`size-3.5 transition-transform ${r.en ? "rotate-180" : ""}`} /> الاسم بالإنجليزية للفاتورة
              </button>
              <span className="text-sm text-ink-2">المبلغ: <b className="num text-ink">{money(num(r.qty) * (num(r.govt_unit) + num(r.fee_unit)), "")}</b></span>
            </div>
            {r.en && (
              <div className="mt-2 ps-8"><Input value={r.description_en} onChange={(e) => patch(r.key, { description_en: e.target.value })} dir="ltr" className="text-start" placeholder="English description (optional)" /></div>
            )}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-3 gap-2 rounded-card bg-navy-soft p-3 text-center">
        <div><div className="text-xs text-ink-2">رسوم حكومية</div><div className="font-semibold num text-ink">{money(totals.govt, "")}</div></div>
        <div><div className="text-xs text-ink-2">أتعاب المكتب</div><div className="font-semibold num text-ink">{money(totals.fee, "")}</div></div>
        <div><div className="text-xs text-ink-2">المجموع</div><div className="text-lg font-bold num text-navy">{money(totals.total, "")}</div></div>
      </div>
    </div>
  );
}
