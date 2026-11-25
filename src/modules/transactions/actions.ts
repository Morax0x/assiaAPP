"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAction } from "@/lib/auth";
import { safe, formObj, emptyToNull, type Result } from "@/lib/action";
import { itemTotals, parseItems, titleFromItems } from "@/lib/items";

const num = (label: string) => z.coerce.number({ message: `${label} غير صالح` }).min(0, `${label} لا يمكن أن يكون سالباً`);

const txnSchema = z.object({
  client_id: z.string().uuid("اختر العميل"),
  title: z.string().optional(),
  assignee_id: z.string().optional(),
  discount: num("الخصم").default(0),
  due_date: z.string().optional(),
  status: z.enum(["new", "in_progress", "awaiting_docs", "completed", "cancelled"]).default("new"),
  internal_notes: z.string().optional(),
});

const paySchema = z.object({
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  account_id: z.string().uuid("اختر الحساب"),
  method: z.enum(["cash", "bank_card", "bank_transfer", "cheque"]),
  note: z.string().optional(),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح").optional().or(z.literal("")),
  reference_no: z.string().max(80).optional(),
  paid_by: z.string().max(120).optional(),
  receipt_path: z.string().optional(),
});

function parseTxn(fd: FormData) {
  const o = formObj(fd);
  const v = txnSchema.parse(o);
  const items = parseItems(o.items_json);
  const { govt, fee } = itemTotals(items);
  if (v.discount > govt + fee) throw new Error("الخصم أكبر من إجمالي المعاملة");
  const title = (v.title && v.title.trim().length >= 2 ? v.title.trim() : titleFromItems(items));
  return {
    items,
    row: {
      client_id: v.client_id, title, assignee_id: emptyToNull(v.assignee_id),
      govt_fees: govt, office_fee: fee, discount: v.discount,
      due_date: emptyToNull(v.due_date), status: v.status, internal_notes: emptyToNull(v.internal_notes),
    },
  };
}

export async function createTransaction(fd: FormData): Promise<Result<{ id: string }>> {
  return safe(async () => {
    const s = await requireAction("txn.write");
    const { row, items } = parseTxn(fd);
    const supabase = await createClient();
    const { data, error } = await supabase.from("transactions").insert({ ...row, created_by: s.userId }).select("id").single();
    if (error) throw error;
    const { error: ie } = await supabase.rpc("set_transaction_items", { p_txn: data.id, p_items: items });
    if (ie) throw ie;

    const initial = formObj(fd);
    if (initial.init_amount && Number(initial.init_amount) > 0) {
      const p = paySchema.parse({ amount: initial.init_amount, account_id: initial.init_account, method: initial.init_method, note: "دفعة مقدمة" });
      const { error: e2 } = await supabase.rpc("record_client_payment", { p_txn: data.id, p_account: p.account_id, p_amount: p.amount, p_method: p.method, p_note: p.note });
      if (e2) throw new Error("أُنشئت المعاملة لكن تعذر تسجيل الدفعة: " + e2.message);
    }
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
    return { id: data.id as string };
  });
}

export async function createTransactionAndGo(fd: FormData): Promise<Result<never>> {
  const r = await createTransaction(fd);
  if (!r.ok) return r as Result<never>;
  redirect(`/transactions/${(r.data as { id: string }).id}`);
}

export async function updateTransaction(id: string, fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("txn.write");
    const { row, items } = parseTxn(fd);
    const supabase = await createClient();
    const { error } = await supabase.from("transactions").update(row).eq("id", id);
    if (error) throw error;
    const { error: ie } = await supabase.rpc("set_transaction_items", { p_txn: id, p_items: items });
    if (ie) throw ie;
    revalidatePath(`/transactions/${id}`);
    revalidatePath("/transactions");
  });
}

export async function setTransactionStatus(id: string, status: string): Promise<Result> {
  return safe(async () => {
    await requireAction("txn.write");
    const supabase = await createClient();
    const { error } = await supabase.from("transactions").update({ status }).eq("id", id);
    if (error) throw error;
    revalidatePath(`/transactions/${id}`);
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
  });
}

export async function recordPayment(txnId: string, fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("txn.write");
    const p = paySchema.parse(formObj(fd));
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_client_payment", {
      p_txn: txnId, p_account: p.account_id, p_amount: p.amount, p_method: p.method, p_note: emptyToNull(p.note),
      p_occurred_at: emptyToNull(p.occurred_at), p_reference: emptyToNull(p.reference_no), p_receipt: emptyToNull(p.receipt_path), p_paid_by: emptyToNull(p.paid_by),
    });
    if (error) throw error;
    revalidatePath(`/transactions/${txnId}`);
    revalidatePath("/transactions");
    revalidatePath("/receivables");
    revalidatePath("/treasury");
    revalidatePath("/dashboard");
  });
}

export async function recordGovtFee(txnId: string, fd: FormData): Promise<Result> {
  return safe(async () => {
    await requireAction("treasury.write");
    const p = paySchema.parse(formObj(fd));
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_govt_fee", {
      p_txn: txnId, p_account: p.account_id, p_amount: p.amount, p_method: p.method, p_note: emptyToNull(p.note),
      p_occurred_at: emptyToNull(p.occurred_at), p_reference: emptyToNull(p.reference_no), p_receipt: emptyToNull(p.receipt_path),
    });
    if (error) throw error;
    revalidatePath(`/transactions/${txnId}`);
    revalidatePath("/treasury");
    revalidatePath("/dashboard");
  });
}

export async function deleteTransaction(id: string): Promise<Result> {
  const r = await safe(async () => {
    await requireAction("txn.delete");
    const supabase = await createClient();
    const { error } = await supabase.rpc("soft_delete_record", { p_table: "transactions", p_id: id });
    if (error) throw error;
  });
  if (r.ok) redirect("/transactions");
  return r;
}

export async function getPaymentReceiptUrl(entryId: string): Promise<Result<{ url: string }>> {
  return safe(async () => {
    await requireAction();
    const supabase = await createClient();
    const { data: path, error } = await supabase.rpc("payment_receipt_path", { p_entry: entryId });
    if (error || !path) throw new Error("لا يوجد إيصال مرفق");
    const { data, error: e2 } = await createAdminClient().storage.from("vault").createSignedUrl(path as string, 120);
    if (e2 || !data) throw new Error("تعذر فتح الإيصال");
    return { url: data.signedUrl };
  });
}
