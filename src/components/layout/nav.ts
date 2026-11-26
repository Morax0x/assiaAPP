import {
  LayoutDashboard, FileText, Users, BellRing, Landmark, Settings, WalletCards, FolderOpen, ScanSearch, BarChart3, CircleHelp, Tags, FileSpreadsheet, Receipt,
} from "lucide-react";
import type { PermKey } from "@/lib/permissions";

export type NavGroup = "main" | "money" | "tools";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: NavGroup;
  perm?: PermKey;
  anyOf?: PermKey[];
  primaryMobile?: boolean;
};

export const GROUPS: { key: NavGroup; label: string }[] = [
  { key: "main", label: "العمل اليومي" },
  { key: "money", label: "المال" },
  { key: "tools", label: "أدوات" },
];

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard, group: "main", primaryMobile: true },
  { href: "/transactions", label: "المعاملات", icon: FileText, group: "main", primaryMobile: true },
  { href: "/clients", label: "العملاء", icon: Users, group: "main", primaryMobile: true },
  { href: "/documents", label: "المستندات", icon: FolderOpen, group: "main", primaryMobile: true },
  { href: "/invoices", label: "الفواتير", icon: Receipt, group: "main" },
  { href: "/quotes", label: "عروض الأسعار", icon: FileSpreadsheet, group: "main" },
  { href: "/services", label: "الخدمات والأسعار", icon: Tags, group: "main" },
  { href: "/receivables", label: "المبالغ المتبقية على العملاء", icon: WalletCards, group: "money" },
  { href: "/treasury", label: "الصندوق والبطاقة", icon: Landmark, group: "money", perm: "treasury.view" },
  { href: "/reports", label: "التقارير والأرباح", icon: BarChart3, group: "money", perm: "reports.view" },
  { href: "/alerts", label: "تنبيهات التجديد", icon: BellRing, group: "tools" },
  { href: "/search", label: "بحث بالكتابة أو الصوت", icon: ScanSearch, group: "tools" },
  { href: "/help", label: "المساعدة والشرح", icon: CircleHelp, group: "tools" },
  {
    href: "/settings", label: "الإعدادات", icon: Settings, group: "tools",
    anyOf: ["settings.manage", "users.manage", "share.create", "audit.view", "clients.delete", "txn.delete", "docs.delete"],
  },
];

export function visibleNav(perms: string[]) {
  return NAV.filter((n) => (!n.perm || perms.includes(n.perm)) && (!n.anyOf || n.anyOf.some((p) => perms.includes(p))));
}
