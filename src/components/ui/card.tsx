import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)} {...p} />;
}

export function CardHeader({ title, action, className }: { title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-2.5", className)}>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {action}
    </div>
  );
}

/** Big, obvious back button for detail / form pages. */
export function BackLink({ href, label = "رجوع" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="mb-3 inline-flex h-10 items-center gap-2 rounded-ctl border border-line bg-surface px-3.5 text-[15px] font-medium text-ink-2 hover:border-navy hover:text-navy">
      <ArrowRight className="size-4" strokeWidth={2} /> {label}
    </Link>
  );
}

export function PageHeader({
  title, description, actions, back,
}: { title: string; description?: string; actions?: React.ReactNode; back?: { href: string; label?: string } }) {
  return (
    <div className="mb-6">
      {back && <BackLink href={back.href} label={back.label} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-[15px] leading-7 text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Empty({
  icon, title, hint, action,
}: { icon?: React.ReactNode; title: string; hint?: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 flex size-14 items-center justify-center rounded-full bg-mute-soft text-ink-3 [&_svg]:size-7 [&_svg]:stroke-[1.5]">{icon}</div>}
      <p className="text-base font-semibold text-ink-2">{title}</p>
      {hint && <p className="max-w-sm text-sm leading-6 text-ink-3">{hint}</p>}
      {action && (
        <Link href={action.href} className="mt-3 inline-flex h-11 items-center rounded-ctl bg-navy px-5 text-[15px] font-medium text-white hover:bg-navy-hover">{action.label}</Link>
      )}
    </div>
  );
}
