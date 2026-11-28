"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell, CircleHelp, ChevronsRight, ChevronsLeft, LogOut, Menu, Plus, Search, X,
  FilePlus2, UserPlus, Upload, Receipt,
} from "lucide-react";
import { GROUPS, NAV, type NavItem } from "@/components/layout/nav";
import { Brand, LogoMark } from "@/components/layout/logo";
import { CommandPalette } from "@/components/layout/command-palette";
import { DisplayMenuButton, TopbarDisplay } from "@/components/layout/theme-controls";
import { cn } from "@/lib/utils";
import { signOut } from "@/modules/auth/actions";

type Props = {
  children: React.ReactNode;
  perms: string[];
  user: { name: string; role: string };
  alertCount: number;
};

function isActive(path: string, href: string) {
  return path === href || path.startsWith(href + "/");
}

function NavGroups({ items, path, collapsed, alertCount }: { items: NavItem[]; path: string; collapsed?: boolean; alertCount: number }) {
  return (
    <>
      {GROUPS.map((g) => {
        const list = items.filter((n) => n.group === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key} className="mb-2">
            {collapsed ? <div className="mx-3 my-2 border-t border-line" /> : <div className="px-3 pb-1.5 pt-3 text-xs font-bold tracking-wide text-ink-3">{g.label}</div>}
            <div className="space-y-0.5">
              {list.map((n) => {
                const active = isActive(path, n.href);
                return (
                  <Link
                    key={n.href} href={n.href} title={collapsed ? n.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-ctl px-3 py-2 text-[15px] leading-snug transition-colors",
                      collapsed && "justify-center px-0",
                      active ? "bg-navy-soft font-semibold text-navy" : "text-ink-2 hover:bg-mute-soft hover:text-ink",
                    )}
                  >
                    {active && !collapsed && <span className="absolute inset-y-2 end-0 w-1 rounded-full bg-navy" />}
                    <n.icon className="size-5 shrink-0" strokeWidth={1.75} />
                    {!collapsed && <span className="flex-1">{n.label}</span>}
                    {!collapsed && n.href === "/alerts" && alertCount > 0 && (
                      <span className="rounded-full bg-orange px-2 text-xs font-semibold leading-5 text-white num">{alertCount}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function AppShell({ children, perms, user, alertCount }: Props) {
  const path = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [palette, setPalette] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [fab, setFab] = React.useState(false);

  React.useEffect(() => {
    try { setCollapsed(localStorage.getItem("sb") === "1"); } catch {}
  }, []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => { setDrawer(false); setFab(false); }, [path]);

  const items = NAV.filter((n) => (!n.perm || perms.includes(n.perm)) && (!n.anyOf || n.anyOf.some((p) => perms.includes(p))));
  const mobilePrimary = items.filter((n) => n.primaryMobile);
  const toggle = () => {
    setCollapsed((c) => { try { localStorage.setItem("sb", c ? "0" : "1"); } catch {} return !c; });
  };

  const quick = [
    perms.includes("txn.write") && { href: "/transactions/new", label: "معاملة جديدة", icon: FilePlus2 },
    perms.includes("clients.write") && { href: "/clients/new", label: "عميل جديد", icon: UserPlus },
    perms.includes("docs.write") && { href: "/documents/new", label: "رفع مستند", icon: Upload },
    perms.includes("treasury.write") && { href: "/treasury?new=expense", label: "تسجيل مصروف", icon: Receipt },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Plus }[];

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-30 hidden flex-col print:!hidden border-e border-line bg-surface transition-[width] md:flex",
          collapsed ? "w-[68px]" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-line", collapsed ? "justify-center" : "px-4")}>
          <Brand compact={collapsed} />
        </div>
        <nav className="flex-1 overflow-y-auto p-2"><NavGroups items={items} path={path} collapsed={collapsed} alertCount={alertCount} /></nav>
        <div className="border-t border-line p-2">
          {!collapsed && <DisplayMenuButton className="mb-1 h-9 text-xs text-ink-3" />}
          <button
            onClick={toggle}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-ctl text-xs text-ink-3 hover:bg-mute-soft"
            aria-label="طي القائمة"
          >
            {collapsed ? <ChevronsLeft className="size-4" strokeWidth={1.75} /> : <><ChevronsRight className="size-4" strokeWidth={1.75} /> طي القائمة</>}
          </button>
        </div>
      </aside>

      <div className={cn("transition-[padding] print:!ps-0", collapsed ? "md:ps-[68px]" : "md:ps-60")}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 print:hidden border-b border-line bg-surface/95 backdrop-blur safe-t">
          <div className="flex h-14 items-center gap-2 px-3 md:px-6">
            <button className="rounded-md p-2 text-ink-2 hover:bg-mute-soft md:hidden" onClick={() => setDrawer(true)} aria-label="القائمة">
              <Menu className="size-5" strokeWidth={1.75} />
            </button>
            <Link href="/dashboard" className="md:hidden" aria-label="الصفحة الرئيسية"><LogoMark className="size-7" /></Link>
            <button
              onClick={() => setPalette(true)}
              className="ms-auto flex h-10 min-w-0 items-center gap-2 rounded-ctl border border-line bg-bg px-3 text-sm text-ink-3 hover:border-line-strong md:ms-0 md:w-80"
            >
              <Search className="size-4" strokeWidth={1.75} />
              <span className="flex-1 text-start">ابحث هنا</span>
              <kbd className="hidden rounded border border-line bg-surface px-1.5 text-[11px] md:block num">Ctrl K</kbd>
            </button>
            <div className="hidden flex-1 md:block" />
            <Link href="/help" className="hidden size-10 items-center justify-center rounded-md text-ink-2 hover:bg-mute-soft sm:flex" aria-label="المساعدة" title="المساعدة والشرح"><CircleHelp className="size-5" strokeWidth={1.75} /></Link>
            <TopbarDisplay />
            <Link href="/alerts" className="relative rounded-md p-2.5 text-ink-2 hover:bg-mute-soft" aria-label="التنبيهات">
              <Bell className="size-5" strokeWidth={1.75} />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 end-0 min-w-4 rounded-full bg-orange px-1 text-center text-[10px] font-semibold leading-4 text-white num">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </Link>
            <div className="hidden items-center gap-3 border-s border-line ps-3 md:flex">
              <div className="text-end leading-tight">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-[11px] text-ink-3">{user.role}</div>
              </div>
              <form action={signOut}>
                <button className="rounded-md p-2 text-ink-3 hover:bg-mute-soft hover:text-ink" aria-label="تسجيل الخروج" title="تسجيل الخروج">
                  <LogOut className="size-[18px]" strokeWidth={1.75} />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-3 pb-28 pt-5 md:px-6 md:pb-10 md:pt-7">{children}</main>
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute start-0 top-0 flex h-dvh max-h-dvh w-72 max-w-[85vw] flex-col overflow-hidden bg-surface safe-t">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <div onClick={() => setDrawer(false)}><Brand /></div>
              <button onClick={() => setDrawer(false)} className="rounded-md p-1.5 hover:bg-mute-soft" aria-label="إغلاق">
                <X className="size-5" strokeWidth={1.75} />
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto p-2"><NavGroups items={items} path={path} alertCount={alertCount} /></nav>
            <div className="shrink-0 border-t border-line p-3 safe-b">
              <DisplayMenuButton className="mb-2 border border-line" />
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-medium">{user.name}</div>
                  <div className="truncate text-xs text-ink-3">{user.role}</div>
                </div>
                <form action={signOut}>
                  <button className="flex h-10 items-center justify-center gap-2 rounded-ctl border border-line px-3 text-sm text-ink-2" aria-label="تسجيل الخروج">
                    <LogOut className="size-4" strokeWidth={1.75} /> خروج
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav + FAB */}
      <nav className="fixed inset-x-0 bottom-0 z-30 print:hidden border-t border-line bg-surface md:hidden safe-b">
        <div className="grid grid-cols-4">
          {mobilePrimary.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link key={n.href} href={n.href} className={cn("relative flex h-16 flex-col items-center justify-center gap-0.5 text-xs", active ? "text-navy" : "text-ink-3")}>
                <n.icon className="size-5" strokeWidth={active ? 2 : 1.75} />
                {n.label}
                {n.href === "/alerts" && alertCount > 0 && (
                  <span className="absolute end-[22%] top-1.5 size-2 rounded-full bg-orange" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      {quick.length > 0 && !drawer && (
        <div className="md:hidden print:hidden">
          {fab && <div className="fixed inset-0 z-30 bg-ink/30" onClick={() => setFab(false)} />}
          <div className="fixed end-4 z-40 flex flex-col items-end gap-2" style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}>
            {fab &&
              quick.map((q) => (
                <Link key={q.href} href={q.href} className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface ps-4 pe-3 text-sm shadow-sm">
                  {q.label}
                  <q.icon className="size-4 text-navy" strokeWidth={1.75} />
                </Link>
              ))}
            <button
              onClick={() => setFab((v) => !v)}
              className="flex size-12 items-center justify-center rounded-full bg-orange text-white shadow-md active:bg-orange-hover"
              aria-label="إضافة سريعة"
            >
              <Plus className={cn("size-6 transition-transform", fab && "rotate-45")} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}
