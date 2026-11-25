"use server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export type SearchHit = { type: "client" | "transaction" | "document"; id: string; title: string; sub?: string; href: string };

export async function searchAll(q: string): Promise<SearchHit[]> {
  const s = await getSession();
  if (!s) return [];
  const term = q.trim().replace(/[%,()*"\\]/g, " ").trim();
  if (term.length < 2) return [];
  const supabase = await createClient();
  const like = `%${term}%`;
  const likeQ = `"${like}"`;
  const [c, t, d] = await Promise.all([
    supabase.from("clients").select("id,name,phone").is("deleted_at", null).or(`name.ilike.${likeQ},phone.ilike.${likeQ}`).limit(6),
    supabase.from("transactions_list").select("id,ref_no,title,client_name").or(`ref_no.ilike.${likeQ},title.ilike.${likeQ},client_name.ilike.${likeQ}`).limit(6),
    supabase.from("documents").select("id,title,client_id,clients(name)").is("deleted_at", null).eq("is_current", true).ilike("title", like).limit(6),
  ]);
  const hits: SearchHit[] = [];
  (c.data ?? []).forEach((r) => hits.push({ type: "client", id: r.id, title: r.name, sub: r.phone ?? undefined, href: `/clients/${r.id}` }));
  (t.data ?? []).forEach((r) => hits.push({ type: "transaction", id: r.id, title: `${r.ref_no} — ${r.title}`, sub: r.client_name, href: `/transactions/${r.id}` }));
  (d.data ?? []).forEach((r) => {
    const cn = (r as unknown as { clients: { name: string } | null }).clients?.name;
    hits.push({ type: "document", id: r.id, title: r.title, sub: cn, href: `/clients/${r.client_id}?tab=documents` });
  });
  return hits;
}
