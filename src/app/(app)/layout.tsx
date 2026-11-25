import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const supabase = await createClient();
  const { count } = await supabase
    .from("document_alerts")
    .select("id", { count: "exact", head: true })
    .in("bucket", ["expired", "critical"]);
  return (
    <AppShell perms={[...s.perms]} user={{ name: s.profile.full_name, role: s.profile.role }} alertCount={count ?? 0}>
      {children}
    </AppShell>
  );
}
