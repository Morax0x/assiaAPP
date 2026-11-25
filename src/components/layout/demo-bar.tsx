import { FlaskConical } from "lucide-react";

const ROLES = [
  { key: "owner", label: "صاحب العمل" },
  { key: "admin", label: "مدير المكتب" },
  { key: "staff", label: "موظف" },
];

/** Shown only in demo mode: explains it is sample data and lets you switch the viewing role. */
export function DemoBar({ current }: { current: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-orange/40 bg-orange-soft px-4 py-3 text-sm print:hidden">
      <span className="flex items-center gap-2 font-semibold text-orange-hover">
        <FlaskConical className="size-4" strokeWidth={1.75} /> نسخة تجريبية ببيانات وهمية
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-ink-2">شاهده كـ:</span>
        {ROLES.map((r) => (
          <a
            key={r.key} href={`/demo/role/${r.key}`}
            className={`rounded-full border px-3 py-1 text-[13px] font-medium ${current === r.key ? "border-navy bg-navy text-white" : "border-line-strong bg-surface text-ink-2 hover:border-navy"}`}
          >
            {r.label}
          </a>
        ))}
      </span>
    </div>
  );
}
