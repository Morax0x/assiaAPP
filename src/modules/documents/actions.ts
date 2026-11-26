"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteStoredFiles, signedDownload } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAction } from "@/lib/auth";
import { safe, emptyToNull } from "@/lib/action";
import { MAX_FILE_BYTES } from "@/lib/keys";

const docSchema = z.object({
  client_id: z.string().uuid(),
  transaction_id: z.string().uuid().nullable().optional(),
  type_id: z.string().uuid().nullable().optional(),
  custom_type: z.string().max(60).nullable().optional(),
  folder: z.string().max(300).nullable().optional(),
  tag: z.string().max(80).nullable().optional(),
  title: z.string().min(1).max(200),
  issue_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  storage_path: z.string().min(5),
  mime_type: z.string().min(3),
  size_bytes: z.number().int().min(1, "الملف فارغ").max(MAX_FILE_BYTES),
});

/** A stored path is acceptable if it is a plain relative key that does not point into receipts/expenses. */
function okStoredPath(p: string) {
  return p.length > 0 && p.length <= 600 && !p.startsWith("/") && !p.includes("..") && !/[\\\u0000-\u001f]/.test(p) && !/^(receipts|expenses|healthcheck)\//.test(p);
}

/** Normalises a folder path: no leading/trailing slashes, no empty parts, forward slashes only. */
function cleanFolder(f?: string | null) {
  const v = (f ?? "").replace(/\\/g, "/").split("/").map((x) => x.trim()).filter(Boolean).join("/");
  return v ? v.slice(0, 300) : null;
}

/** Finds a document type by name or creates it (so typing a new type once makes it available everywhere). */
async function ensureType(name: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_document_type", { p_name: name });
  if (error || !data) throw new Error(error?.message ?? "تعذر إنشاء نوع المستند");
  return data as string;
}

export async function createDocuments(items: z.input<typeof docSchema>[]) {
  return safe(async () => {
    const s = await requireAction("docs.write");
    const supabase = await createClient();
    const typeCache = new Map<string, string>();
    const resolve = async (type_id?: string | null, custom?: string | null) => {
      const name = custom?.trim();
      if (name) {
        const k = name.toLowerCase();
        if (!typeCache.has(k)) typeCache.set(k, await ensureType(name));
        return typeCache.get(k)!;
      }
      if (!type_id) throw new Error("اختر نوع المستند أو اكتب نوعاً جديداً");
      return type_id;
    };
    const rows = [];
    for (const i of items) {
      const d = docSchema.parse(i);
      if (!okStoredPath(d.storage_path)) throw new Error("مسار الملف غير صالح");
      const { custom_type, ...rest } = d;
      rows.push({
        ...rest,
        type_id: await resolve(d.type_id, custom_type),
        folder: cleanFolder(d.folder), tag: emptyToNull(d.tag?.trim() || undefined),
        transaction_id: emptyToNull(d.transaction_id ?? undefined),
        issue_date: emptyToNull(d.issue_date ?? undefined),
        expiry_date: emptyToNull(d.expiry_date ?? undefined),
        uploaded_by: s.userId,
      });
    }
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
    const ext = doc.storage_path.split(".").pop() ?? "";
    const url = await signedDownload(doc.storage_path, { seconds: 120, downloadName: download ? `${doc.title}.${ext}` : undefined });
    return { url, mime: doc.mime_type as string, title: doc.title as string };
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

const editSchema = z.object({
  title: z.string().trim().min(1, "اكتب اسم المستند").max(200),
  type_id: z.string().uuid().nullable().optional(),
  custom_type: z.string().max(60).nullable().optional(),
  issue_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  transaction_id: z.string().uuid().nullable().optional(),
  folder: z.string().max(300).nullable().optional(),
  tag: z.string().max(80).nullable().optional(),
});

/** Edit a document's name, type, dates and the transaction it belongs to. */
export async function updateDocument(id: string, input: z.input<typeof editSchema>) {
  return safe(async () => {
    await requireAction("docs.write");
    const v = editSchema.parse(input);
    if (v.issue_date && v.expiry_date && v.expiry_date < v.issue_date) throw new Error("تاريخ الانتهاء قبل تاريخ الإصدار");
    const supabase = await createClient();
    const typeId = v.custom_type?.trim() ? await ensureType(v.custom_type) : v.type_id;
    if (!typeId) throw new Error("اختر نوع المستند أو اكتب نوعاً جديداً");
    const { data: cur } = await supabase.from("documents").select("client_id,group_id").eq("id", id).single();
    if (!cur) throw new Error("المستند غير موجود");
    if (v.transaction_id) {
      const { data: t } = await supabase.from("transactions").select("id").eq("id", v.transaction_id).eq("client_id", cur.client_id).maybeSingle();
      if (!t) throw new Error("هذه المعاملة لا تتبع هذا العميل");
    }
    const { error } = await supabase.from("documents").update({
      title: v.title, type_id: typeId, issue_date: emptyToNull(v.issue_date ?? undefined), expiry_date: emptyToNull(v.expiry_date ?? undefined),
      transaction_id: emptyToNull(v.transaction_id ?? undefined), folder: cleanFolder(v.folder), tag: emptyToNull(v.tag?.trim() || undefined),
    }).eq("id", id);
    if (error) throw error;
    ["/alerts", "/documents", "/dashboard", `/clients/${cur.client_id}`].forEach((p) => revalidatePath(p));
  });
}

/** Move documents (with their older versions) to another client, optionally into one of that client's transactions. */
export async function moveDocuments(ids: string[], clientId: string, transactionId: string | null) {
  return safe(async () => {
    await requireAction("docs.write");
    if (!ids.length) throw new Error("اختر مستنداً واحداً على الأقل");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("move_documents", { p_ids: ids, p_client: clientId, p_txn: transactionId });
    if (error) throw error;
    ["/alerts", "/documents", "/clients", "/transactions", "/dashboard"].forEach((p) => revalidatePath(p));
    return { moved: Number(data ?? 0) };
  });
}

export async function listClientTransactions(clientId: string) {
  return safe(async () => {
    await requireAction();
    const supabase = await createClient();
    const { data } = await supabase.from("transactions_list").select("id,ref_no,title").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100);
    return (data ?? []).map((t) => ({ id: t.id as string, label: `${t.ref_no} — ${t.title}` }));
  });
}

/** Finds a client by exact name (any kind) or creates it. Used when importing a folder per client. */
export async function ensureClient(name: string, kind: "individual" | "company" | "sponsor", parentId?: string | null) {
  return safe(async () => {
    const s = await requireAction("clients.write");
    const n = name.trim().replace(/\s+/g, " ");
    if (n.length < 2) throw new Error("اسم العميل قصير");
    const supabase = await createClient();
    let q = supabase.from("clients").select("id,kind").is("deleted_at", null).ilike("name", n.replace(/[%_]/g, ""));
    q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
    const { data: found } = await q.limit(5);
    const exact = (found ?? [])[0];
    if (exact) return { id: exact.id as string, created: false };
    const { data, error } = await supabase.from("clients").insert({ name: n, kind, parent_id: kind === "company" ? null : parentId ?? null, created_by: s.userId }).select("id").single();
    if (error) throw error;
    revalidatePath("/clients");
    return { id: data.id as string, created: true };
  });
}

const WIPE_PHRASE = "حذف كل المستندات";

/**
 * TEMPORARY owner-only tool: permanently deletes every document (database rows and stored files)
 * so a folder import can be redone in the right order. Clients are kept (re-imports reuse them by name).
 */
export async function wipeAllDocuments(phrase: string) {
  return safe(async () => {
    const s = await requireAction("settings.manage");
    if (s.profile.role !== "owner") throw new Error("للمالك فقط");
    if (phrase.trim() !== WIPE_PHRASE) throw new Error(`اكتب العبارة «${WIPE_PHRASE}» كما هي للتأكيد`);
    const admin = createAdminClient();
    let deleted = 0, files = 0;
    for (let round = 0; round < 500; round++) {
      const { data, error } = await admin.from("documents").select("id,storage_path").limit(500);
      if (error) throw error;
      const rows = (data ?? []) as { id: string; storage_path: string }[];
      if (!rows.length) break;
      const ids = rows.map((r) => r.id);
      const a = await admin.from("transactions").update({ renewal_of_document: null }).in("renewal_of_document", ids);
      if (a.error) throw a.error;
      const b = await admin.from("share_link_documents").delete().in("document_id", ids);
      if (b.error) throw b.error;
      files += await deleteStoredFiles(rows.map((r) => r.storage_path));
      const c = await admin.from("documents").delete().in("id", ids);
      if (c.error) throw c.error;
      deleted += ids.length;
    }
    console.log(`[wipe-documents] by ${s.userId}: ${deleted} documents, ${files} files`);
    revalidatePath("/documents"); revalidatePath("/alerts"); revalidatePath("/dashboard");
    return { deleted, files };
  });
}
