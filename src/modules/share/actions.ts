"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAction } from "@/lib/auth";
import { safe, type Result } from "@/lib/action";
import { hashPin, newToken, pinCookieName, pinCookieValue, sha256, siteUrl, verifyPin } from "@/lib/share";

const schema = z.object({
  scope: z.enum(["transaction", "client_folder", "documents"]),
  client_id: z.string().uuid().nullable().optional(),
  transaction_id: z.string().uuid().nullable().optional(),
  document_ids: z.array(z.string().uuid()).optional(),
  days: z.number().int().min(1).max(30),
  pin: z.string().regex(/^\d{4,8}$/, "الرمز من 4 إلى 8 أرقام").optional().or(z.literal("")),
  allow_download: z.boolean().default(true),
});

export async function createShareLink(input: z.input<typeof schema>): Promise<Result<{ url: string }>> {
  return safe(async () => {
    const s = await requireAction("share.create");
    const v = schema.parse(input);
    const supabase = await createClient();
    if (v.scope === "transaction" && !v.transaction_id) throw new Error("المعاملة مطلوبة");
    if (v.scope === "client_folder" && !v.client_id) throw new Error("العميل مطلوب");
    if (v.scope === "documents" && !v.document_ids?.length) throw new Error("اختر مستنداً واحداً على الأقل");

    const token = newToken();
    const expires = new Date(Date.now() + v.days * 86400_000).toISOString();
    const { data: link, error } = await supabase
      .from("share_links")
      .insert({
        token_hash: sha256(token),
        scope: v.scope,
        client_id: v.client_id ?? null,
        transaction_id: v.transaction_id ?? null,
        pin_hash: v.pin ? hashPin(v.pin) : null,
        expires_at: expires,
        allow_download: v.allow_download,
        created_by: s.userId,
      })
      .select("id").single();
    if (error) throw error;
    if (v.scope === "documents") {
      const { error: e2 } = await supabase
        .from("share_link_documents")
        .insert(v.document_ids!.map((d) => ({ link_id: link.id, document_id: d })));
      if (e2) throw e2;
    }
    revalidatePath("/settings/shares");
    return { url: `${siteUrl()}/share/${token}` };
  });
}

export async function revokeShareLink(id: string): Promise<Result> {
  return safe(async () => {
    await requireAction("share.create");
    const supabase = await createClient();
    const { error } = await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    revalidatePath("/settings/shares");
  });
}

/** Public: verify a PIN for a link. Server-side attempt limiting. */
export async function submitSharePin(token: string, _prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const pin = String(fd.get("pin") ?? "").trim();
  const admin = createAdminClient();
  const { data: link } = await admin.from("share_links").select("id,pin_hash,pin_attempts,revoked_at,expires_at").eq("token_hash", sha256(token)).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return { error: "الرابط غير صالح" };
  if (!link.pin_hash) return { ok: true };
  if (link.pin_attempts >= 5) return { error: "تم إيقاف الرابط بعد محاولات خاطئة. اطلب رابطاً جديداً." };
  if (!verifyPin(pin, link.pin_hash)) {
    await admin.from("share_links").update({ pin_attempts: link.pin_attempts + 1 }).eq("id", link.id);
    return { error: "الرمز غير صحيح" };
  }
  await admin.from("share_links").update({ pin_attempts: 0 }).eq("id", link.id);
  const jar = await cookies();
  jar.set(pinCookieName(link.id), pinCookieValue(link.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 3600, path: "/" });
  return { ok: true };
}
