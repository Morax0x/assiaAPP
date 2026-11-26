"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/auth";
import { safe, formObj, emptyToNull, type Result } from "@/lib/action";

const expenseSchema = z.object({
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  account_id: z.string().uuid("اختر الحساب"),
  category_id: z.string().uuid("اختر البند"),
  description: z.string().optional(),
  receipt_path: z.string().optional(),
  occurred_at: z.string().optional(),
});

function done() {
  ["/treasury", "/dashboard"].forEach((p) => revalidatePath(p));
}

export async function addExpense(fd: FormData): Promise<Result> {
  return safe(async () => {
    const s = await requireAction("treasury.write");
    const v = expenseSchema.parse(formObj(fd));
    if (v.receipt_path && !v.receipt_path.startsWith("expenses/")) throw new Error("مسار الإيصال غير صالح");
    const supabase = await createClient();
    const { error } = await supabase.from("ledger_entries").insert({
      account_id: v.account_id, direction: "out", kind: "expense", amount: v.amount,
      category_id: v.category_id, description: emptyToNull(v.description), receipt_path: emptyToNull(v.receipt_path),
      occurred_at: v.occurred_at ? new Date(v.occurred_at).toISOString() : new Date().toISOString(),
      created_by: s.userId,
    });
    if (error) throw error;
    done();
  });
}

export async function addTransfer(fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("treasury.write");
    const o = formObj(fd);
    const v = z.object({
      from: z.string().uuid("اختر حساب المصدر"), to: z.string().uuid("اختر حساب الوجهة"),
      amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"), note: z.string().optional(),
      occurred_at: z.string().optional(), reference_no: z.string().max(80).optional(),
    }).parse(o);
    if (v.from === v.to) throw new Error("اختر حسابين مختلفين");
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_internal_transfer", { p_from: v.from, p_to: v.to, p_amount: v.amount, p_note: emptyToNull(v.note), p_occurred_at: emptyToNull(v.occurred_at), p_reference: emptyToNull(v.reference_no) });
    if (error) throw error;
    done();
  });
}

export async function reconcile(fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("treasury.write");
    const o = formObj(fd);
    const v = z.object({
      account_id: z.string().uuid(), actual: z.coerce.number().min(0, "الرصيد الفعلي غير صالح"), note: z.string().optional(),
    }).parse(o);
    const supabase = await createClient();
    const { error } = await supabase.rpc("reconcile_account", { p_account: v.account_id, p_actual: v.actual, p_note: emptyToNull(v.note), p_adjust: o.adjust === "on" });
    if (error) throw error;
    done();
  });
}

export async function voidEntry(id: string): Promise<Result> {
  return safe(async () => {
    await requireAction("treasury.write");
    const supabase = await createClient();
    const { error } = await supabase.rpc("void_ledger_entry", { p_id: id });
    if (error) throw error;
    done();
  });
}

export async function saveAccount(fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("settings.manage");
    const v = z.object({
      id: z.string().optional(), name: z.string().min(2, "الاسم مطلوب"),
      kind: z.enum(["cash", "bank", "other"]), opening_balance: z.coerce.number().default(0),
    }).parse(formObj(fd));
    const supabase = await createClient();
    if (v.id) {
      const { error } = await supabase.from("accounts").update({ name: v.name }).eq("id", v.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("accounts").insert({ name: v.name, kind: v.kind, opening_balance: v.opening_balance });
      if (error) throw error;
    }
    done();
    revalidatePath("/settings/accounts");
  });
}

export async function saveCategory(fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("settings.manage");
    const v = z.object({ name: z.string().min(2, "الاسم مطلوب") }).parse(formObj(fd));
    const supabase = await createClient();
    const { error } = await supabase.from("expense_categories").insert({ name: v.name });
    if (error) throw error;
    revalidatePath("/settings/accounts");
  });
}

export async function getReceiptUrl(entryId: string): Promise<Result<{ url: string }>> {
  return safe(async () => {
    await requireAction("treasury.view");
    const supabase = await createClient();
    const { data, error } = await supabase.from("ledger_entries").select("receipt_path").eq("id", entryId).single();
    if (error || !data?.receipt_path) throw new Error("لا يوجد إيصال مرفق");
    const { signedDownload } = await import("@/lib/storage");
    return { url: await signedDownload(data.receipt_path, { seconds: 120 }) };
  });
}
