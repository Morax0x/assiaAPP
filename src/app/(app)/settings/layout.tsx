import { requireSession } from "@/lib/auth";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const p = s.perms;
  const isOwner = s.profile.role === "owner";
  const items = [
    p.has("settings.manage") && { href: "/settings/general", label: "المكتب والفواتير" },
    p.has("settings.manage") && { href: "/settings/reminders", label: "التذكير والتنبيهات" },
    p.has("settings.manage") && { href: "/settings/templates", label: "قوالب الخدمات" },
    p.has("settings.manage") && { href: "/settings/accounts", label: "الحسابات والمصاريف" },
    p.has("users.manage") && { href: "/settings/users", label: "الموظفون" },
    isOwner && { href: "/settings/roles", label: "الأدوار والصلاحيات" },
    p.has("share.create") && { href: "/settings/shares", label: "روابط المشاركة" },
    p.has("audit.view") && { href: "/settings/audit", label: "سجل النشاط" },
    isOwner && { href: "/settings/notifications", label: "إشعاراتي" },
  ].filter(Boolean) as { href: string; label: string }[];
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold md:text-2xl">الإعدادات</h1>
      <div className="grid gap-5 md:grid-cols-[13rem_1fr]">
        <SettingsNav items={items} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
