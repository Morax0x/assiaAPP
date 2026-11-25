import {
  LayoutDashboard, FileText, Users, BellRing, Landmark, Settings, WalletCards, FolderOpen, ScanSearch, BarChart3,
} from "lucide-react";
import type { PermKey } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm?: PermKey;
  anyOf?: PermKey[];
  primaryMobile?: boolean;
};

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, primaryMobile: true },
  { href: "/transactions", label: "المعاملات", icon: FileText, primaryMobile: true },
  { href: "/clients", label: "العملاء", icon: Users, primaryMobile: true },
  { href: "/documents", label: "المستندات", icon: FolderOpen, primaryMobile: true },
  { href: "/alerts", label: "التنبيهات", icon: BellRing },
  { href: "/search", label: "البحث الذكي", icon: ScanSearch },
  { href: "/receivables", label: "المستحقات", icon: WalletCards },
  { href: "/treasury", label: "الخزينة", icon: Landmark, perm: "treasury.view" },
  { href: "/reports", label: "التقارير", icon: BarChart3, perm: "reports.view" },
  { href: "/settings", label: "الإعدادات", icon: Settings, anyOf: ["settings.manage", "users.manage", "share.create", "audit.view"] },
];

export function visibleNav(perms: string[]) {
  return NAV.filter((n) => (!n.perm || perms.includes(n.perm)) && (!n.anyOf || n.anyOf.some((p) => perms.includes(p))));
}
