"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAction } from "@/lib/auth";
import { safe, emptyToNull } from "@/lib/action";

const docSchema = z.object({
  client_id: z.string().uuid(),
  transaction_id: z.string().uuid().nullable().optional(),
  type_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  issue_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  storage_path: z.string().min(5),
  mime_type: z.string().min(3),
  size_bytes: z.number().int().positive().max(15 * 1024 * 1024),
});

export async function createDocuments(items: z.input<typeof docSchema>[]) {
  return safe(async () => {
    const s = await requireAction("docs.write");
    const supabase = await createClient();
    const rows = items.map((i) => {
      const d = docSchema.parse(i);
      if (!d.storage_path.startsWith(`clients/${d.client_id}/`)) throw new Error("مسار الملف غير صالح");
      return {
        ...d,
        transaction_id: emptyToNull(d.transaction_id ?? undefined),
        issue_date: emptyToNull(d.issue_date ?? undefined),
        expiry_date: emptyToNull(d.expiry_date ?? undefined),
        uploaded_by: s.userId,
      };
    });
    const { error } = await supabase.from("documents").insert(rows);
    if (error) throw error;
    revalidatePath("/alerts");
    revalidatePath(`/clients/${rows[0]?.client_id}`);
    return rows.length;
  });
}

export async function renewDocument(input: {
  old_id: string; storage_path: string; mime_type: string; size_bytes: number;
  issue_date: string | null; expiry_date: string | null;
}) {
  return safe(async () => {
    await requireAction("docs.write");
    if (!input.expiry_date) throw new Error("تاريخ الانتهاء الجديد مطلوب");
    const supabase = await createClient();
    const { error } = await supabase.rpc("renew_document", {
      p_old: input.old_id,
      p_storage_path: input.storage_path,
      p_mime: input.mime_type,
      p_size: input.size_bytes,
      p_issue: emptyToNull(input.issue_date ?? undefined),
      p_expiry: input.expiry_date,
    });
    if (error) throw error;
    revalidatePath("/alerts");
    revalidatePath("/dashboard");
  });
}

export async function getSignedUrl(documentId: string, download = false) {
  return safe(async () => {
    await requireAction();
    const supabase = await createClient();
    // RLS decides whether this user can see the document row at all
    const { data: doc, error } = await supabase
      .from("documents").select("storage_path,title,mime_type").eq("id", documentId).is("deleted_at", null).single();
    if (error || !doc) throw new Error("المستند غير موجود");
    const admin = createAdminClient();
    const ext = doc.storage_path.split(".").pop() ?? "";
    const { data, error: e2 } = await admin.storage
      .from("vault")
      .createSignedUrl(doc.storage_path, 120, download ? { download: `${doc.title}.${ext}` } : undefined);
    if (e2 || !data) throw new Error("تعذر إنشاء الرابط");
    return { url: data.signedUrl, mime: doc.mime_type as string, title: doc.title as string };
  });
}

export async function setFollowup(documentId: string, followup: string, snoozeDays?: number) {
  return safe(async () => {
    await requireAction("docs.write");
    const supabase = await createClient();
    const patch: Record<string, unknown> = { followup };
    if (followup === "client_notified") patch.notified_at = new Date().toISOString();
    if (followup === "snoozed") {
      const d = new Date();
      d.setDate(d.getDate() + (snoozeDays ?? 7));
      patch.snoozed_until = d.toISOString().slice(0, 10);
    } else {
      patch.snoozed_until = null;
    }
    const { error } = await supabase.from("documents").update(patch).eq("id", documentId);
    if (error) throw error;
    revalidatePath("/alerts");
    revalidatePath("/dashboard");
  });
}

export async function deleteDocument(documentId: string) {
  return safe(async () => {
    await requireAction("docs.delete");
    const supabase = await createClient();
    const { error } = await supabase.rpc("soft_delete_record", { p_table: "documents", p_id: documentId });
    if (error) throw error;
    revalidatePath("/alerts");
  });
}

export async function createRenewalTransaction(documentId: string) {
  return safe(async () => {
    const s = await requireAction("txn.write");
    const supabase = await createClient();
    const { data: d, error } = await supabase
      .from("document_center").select("client_id,title,type_name,id").eq("id", documentId).single();
    if (error || !d) throw new Error("المستند غير موجود");
    const { data: t, error: e2 } = await supabase
      .from("transactions")
      .insert({
        client_id: d.client_id,
        title: `تجديد ${d.type_name}: ${d.title}`,
        status: "in_progress",
        renewal_of_document: d.id,
        assignee_id: s.userId,
        created_by: s.userId,
      })
      .select("id")
      .single();
    if (e2 || !t) throw e2 ?? new Error("تعذر إنشاء المعاملة");
    await supabase.from("documents").update({ followup: "renewal_started" }).eq("id", documentId);
    revalidatePath("/alerts");
    return { id: t.id as string };
  });
}
