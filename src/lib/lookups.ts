import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Common dropdown data for transaction forms. */
export async function loadTxnLookups() {
  const supabase = await createClient();
  const [clients, templates, staff, accounts] = await Promise.all([
    supabase.from("clients").select("id,name").is("deleted_at", null).order("name"),
    supabase.from("service_templates").select("id,name,name_en,category,default_govt_fee,default_office_fee").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id,full_name").eq("is_active", true).order("full_name"),
    supabase.rpc("payable_accounts"),
  ]);
  return {
    clients: (clients.data ?? []) as { id: string; name: string }[],
    templates: (templates.data ?? []).map((t) => ({ id: t.id as string, name: t.name as string, name_en: (t.name_en ?? null) as string | null, category: (t.category ?? null) as string | null, default_govt_fee: Number(t.default_govt_fee), default_office_fee: Number(t.default_office_fee) })),
    staff: (staff.data ?? []).map((p) => ({ id: p.id as string, name: p.full_name as string })),
    accounts: ((accounts.data ?? []) as { id: string; name: string; kind: string }[]),
  };
}
