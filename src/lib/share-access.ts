import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { pinCookieName, pinCookieValue, sha256 } from "@/lib/share";

export type ShareDoc = { id: string; title: string; mime_type: string; expiry_date: string | null; type_name: string };
export type ShareResult =
  | { state: "invalid" }
  | { state: "pin"; locked: boolean }
  | { state: "ok"; link: { id: string; scope: string; allow_download: boolean }; clientName: string; heading: string; docs: ShareDoc[]; officeName: string };

export async function resolveShare(token: string, opts: { count?: boolean } = {}): Promise<ShareResult> {
  const admin = createAdminClient();
  const { data: link } = await admin.from("share_links").select("*").eq("token_hash", sha256(token)).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return { state: "invalid" };

  if (link.pin_hash) {
    const jar = await cookies();
    if (jar.get(pinCookieName(link.id))?.value !== pinCookieValue(link.id)) {
      return { state: "pin", locked: link.pin_attempts >= 5 };
    }
  }

  let clientId: string | null = link.client_id;
  let heading = "مستندات مشاركة";
  let txnId: string | null = null;
  if (link.scope === "transaction" && link.transaction_id) {
    const { data: t } = await admin.from("transactions").select("client_id,title,ref_no").eq("id", link.transaction_id).single();
    if (!t) return { state: "invalid" };
    clientId = t.client_id; txnId = link.transaction_id; heading = `${t.title} (${t.ref_no})`;
  }
  if (!clientId) return { state: "invalid" };
  const { data: client } = await admin.from("clients").select("name").eq("id", clientId).single();

  const sel = "id,title,mime_type,expiry_date,document_types(name)";
  let rows: unknown[] = [];
  if (link.scope === "transaction") {
    const { data } = await admin.from("documents").select(sel).eq("transaction_id", txnId!).eq("is_current", true).is("deleted_at", null).order("created_at");
    rows = data ?? [];
  } else if (link.scope === "client_folder") {
    heading = "ملف المستندات";
    const { data } = await admin.from("documents").select(sel).eq("client_id", clientId).eq("is_current", true).is("deleted_at", null).order("created_at");
    rows = data ?? [];
  } else {
    const { data: ids } = await admin.from("share_link_documents").select("document_id").eq("link_id", link.id);
    const list = (ids ?? []).map((r) => r.document_id);
    if (list.length) {
      const { data } = await admin.from("documents").select(sel).in("id", list).is("deleted_at", null).order("created_at");
      rows = data ?? [];
    }
  }
  const docs: ShareDoc[] = (rows as { id: string; title: string; mime_type: string; expiry_date: string | null; document_types: { name: string } | null }[]).map((d) => ({
    id: d.id, title: d.title, mime_type: d.mime_type, expiry_date: d.expiry_date, type_name: d.document_types?.name ?? "",
  }));

  if (opts.count) {
    await admin.from("share_links").update({ last_viewed_at: new Date().toISOString(), view_count: (link.view_count ?? 0) + 1 }).eq("id", link.id);
  }
  const { data: os } = await admin.from("office_settings").select("office_name").single();
  return { state: "ok", link: { id: link.id, scope: link.scope, allow_download: link.allow_download }, clientName: client?.name ?? "", heading, docs, officeName: os?.office_name ?? "" };
}
