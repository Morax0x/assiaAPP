"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/auth";
import { safe, formObj, emptyToNull, type Result } from "@/lib/action";
import { itemTotals, parseItems } from "@/lib/items";

const schema = z.object({
  client_id: z.string().optional(), client_name: z.string().optional(), client_phone: z.string().optional(),
  valid_until: z.string().optional(), lang: z.enum(["ar", "en", "both"]).default("both"),
  discount: z.coerce.number().min(0, "الخصم لا يمكن أن يكون سالباً").default(0),
  notes: z.string().optional(), internal_notes: z.string().optional(),
});

function parse(fd: FormData) {
  const o = formObj(fd);
  const v = schema.parse(o);
  const items = parseItems(o.items_json);
  const { govt, fee } = itemTotals(items);
  if (v.discount > govt + fee) throw new Error("الخصم أكبر من إجمالي عرض السعر");
  if (!v.client_id && !(v.client_name && v.client_name.trim().length >= 2)) throw new Error("اختر العميل أو اكتب اسمه");
  return {
    items,
    row: {
      client_id: emptyToNull(v.client_id), client_name: v.client_id ? null : emptyToNull(v.client_name), client_phone: v.client_id ? null : emptyToNull(v.client_phone),
      valid_until: emptyToNull(v.valid_until), lang: v.lang, discount: v.discount, notes: emptyToNull(v.notes), internal_notes: emptyToNull(v.internal_notes),
    },
  };
}

export async function createQuote(fd: FormData): Promise<Result<never>> {
  const r = await safe(async () => {
    const s = await requireAction("txn.write");
    const { row, items } = parse(fd);
    const supabase = await createClient();
    const { data, error } = await supabase.from("quotes").insert({ ...row, created_by: s.userId }).select("id").single();
    if (error) throw error;
    const { error: ie } = await supabase.rpc("set_quote_items", { p_quote: data.id, p_items: items });
    if (ie) throw ie;
    revalidatePath("/quotes");
    return data.id as string;
  });
  if (!r.ok) return r as Result<never>;
  redirect(`/quotes/${r.data}`);
}

export async function updateQuote(id: string, fd: FormData): Promise<Result<never>> {
  const r = await safe(async () => {
    await requireAction("txn.write");
    const { row, items } = parse(fd);
    const supabase = await createClient();
    const { error } = await supabase.from("quotes").update(row).eq("id", id);
    if (error) throw error;
    const { error: ie } = await supabase.rpc("set_quote_items", { p_quote: id, p_items: items });
    if (ie) throw ie;
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);
  });
  if (!r.ok) return r as Result<never>;
  redirect(`/quotes/${id}`);
}

export async function setQuoteStatus(id: string, status: string): Promise<Result> {
  return safe(async () => {
    await requireAction("txn.write");
    if (!["draft", "sent", "accepted", "rejected"].includes(status)) throw new Error("حالة غير صالحة");
    const supabase = await createClient();
    const { error } = await supabase.from("quotes").update({ status }).eq("id", id);
    if (error) throw error;
    revalidatePath(`/quotes/${id}`);
    revalidatePath("/quotes");
  });
}

export async function convertQuoteAction(id: string): Promise<Result<never>> {
  const r = await safe(async () => {
    await requireAction("txn.write");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("convert_quote", { p_quote: id });
    if (error) throw error;
    ["/quotes", "/transactions", "/clients", "/dashboard"].forEach((p) => revalidatePath(p));
    return data as string;
  });
  if (!r.ok) return r as Result<never>;
  redirect(`/transactions/${r.data}`);
}

export async function deleteQuote(id: string): Promise<Result<never>> {
  const r = await safe(async () => {
    await requireAction("txn.write");
    const supabase = await createClient();
    const { error } = await supabase.from("quotes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    revalidatePath("/quotes");
  });
  if (!r.ok) return r as Result<never>;
  redirect("/quotes");
}
