import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "الإعدادات" };

export default async function SettingsIndex() {
  const s = await requireSession();
  if (s.perms.has("settings.manage")) redirect("/settings/general");
  if (s.perms.has("users.manage")) redirect("/settings/users");
  if (s.perms.has("share.create")) redirect("/settings/shares");
  if (s.perms.has("clients.delete") || s.perms.has("txn.delete") || s.perms.has("docs.delete")) redirect("/settings/trash");
  redirect("/dashboard");
}
