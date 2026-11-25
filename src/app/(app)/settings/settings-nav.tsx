"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {items.map((i) => (
        <Link
          key={i.href} href={i.href}
          className={cn("shrink-0 rounded-ctl px-3 py-2 text-sm", path === i.href ? "bg-navy-soft font-medium text-navy" : "text-ink-2 hover:bg-mute-soft")}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
