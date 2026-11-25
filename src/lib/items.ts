import { z } from "zod";

const money = (label: string) => z.coerce.number({ message: `${label} غير صالح` }).min(0, `${label} لا يمكن أن يكون سالباً`).max(100_000_000, `${label} كبير جداً`);

export const itemSchema = z.object({
  service_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, "اكتب وصف البند").max(300),
  description_en: z.string().trim().max(300).optional(),
  qty: z.coerce.number({ message: "الكمية غير صالحة" }).positive("الكمية يجب أن تكون أكبر من صفر").max(100000),
  govt_unit: money("الرسوم الحكومية").default(0),
  fee_unit: money("أتعاب المكتب").default(0),
  item_date: z.string().nullable().optional(),
});
export type ItemInput = z.infer<typeof itemSchema>;

/** Parses the hidden `items_json` field sent by the items editor. Blank rows are ignored. */
export function parseItems(raw: string | undefined): ItemInput[] {
  let arr: unknown;
  try { arr = JSON.parse(raw || "[]"); } catch { throw new Error("بيانات البنود غير صالحة"); }
  if (!Array.isArray(arr)) throw new Error("بيانات البنود غير صالحة");
  const rows = arr.filter((r) => r && typeof r === "object" && String((r as { description?: unknown }).description ?? "").trim() !== "");
  if (!rows.length) throw new Error("أضف بنداً واحداً على الأقل");
  return rows.map((r, i) => {
    const p = itemSchema.safeParse(r);
    if (!p.success) throw new Error(`البند ${i + 1}: ${p.error.issues[0]?.message ?? "بيانات غير صالحة"}`);
    return p.data;
  });
}

export function itemTotals(items: ItemInput[]) {
  const govt = items.reduce((a, i) => a + i.qty * i.govt_unit, 0);
  const fee = items.reduce((a, i) => a + i.qty * i.fee_unit, 0);
  return { govt: Math.round(govt * 100) / 100, fee: Math.round(fee * 100) / 100 };
}

export function titleFromItems(items: ItemInput[]) {
  const first = items[0].description;
  return items.length > 1 ? `${first} (+${items.length - 1} ${items.length === 2 ? "بند آخر" : "بنود أخرى"})` : first;
}
