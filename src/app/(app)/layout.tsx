import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DemoBar } from "@/components/layout/demo-bar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ count }, { count: dueReminders }] = await Promise.all([
    supabase.from("document_alerts").select("id", { count: "exact", head: true }).in("bucket", ["expired", "critical"]),
    supabase.from("reminders").select("id", { count: "exact", head: true }).eq("done", false).lte("remind_date", today),
  ]);
  return (
    <AppShell perms={[...s.perms]} user={{ name: s.profile.full_name, role: s.profile.job_title ?? "" }} alertCount={(count ?? 0) + (dueReminders ?? 0)}>
      {process.env.DEMO_MODE === "1" && <DemoBar current={s.profile.role} />}
      {children}
    </AppShell>
  );
}
