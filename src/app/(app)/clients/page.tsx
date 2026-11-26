import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { ClientsTable } from "./clients-table";

export const metadata = { title: "العملاء" };

export default async function ClientsPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const [{ data: clients }, { data: owing }] = await Promise.all([
    supabase.from("clients").select("id,kind,name,phone,email,created_at,parent_id").is("deleted_at", null).order("name"),
    supabase.from("transactions_list").select("client_id,remaining").neq("status", "cancelled").gt("remaining", 0),
  ]);
  const due = new Map<string, number>();
  (owing ?? []).forEach((r) => due.set(r.client_id, (due.get(r.client_id) ?? 0) + Number(r.remaining)));
  const nameOf = new Map((clients ?? []).map((c) => [c.id, c.name as string]));
  const rows = (clients ?? []).map((c) => ({ ...c, due: due.get(c.id) ?? 0, parent_name: c.parent_id ? nameOf.get(c.parent_id) ?? null : null }));
  return (
    <>
      <PageHeader
        title="العملاء"
        description={`${rows.length} عميل. اضغط على أي عميل لفتح ملفه ومعاملاته ومستنداته.`}
        actions={s.perms.has("clients.write") && (
          <Button asChild><Link href="/clients/new"><Plus /> عميل جديد</Link></Button>
        )}
      />
      <ClientsTable rows={rows} />
    </>
  );
}
