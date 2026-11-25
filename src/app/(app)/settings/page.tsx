import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

export default async function SettingsIndex() {
  const s = await requireSession();
  if (s.perms.has("settings.manage")) redirect("/settings/general");
  if (s.perms.has("users.manage")) redirect("/settings/users");
  if (s.perms.has("share.create")) redirect("/settings/shares");
  redirect("/dashboard");
}
