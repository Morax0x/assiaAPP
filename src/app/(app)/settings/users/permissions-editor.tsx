"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PERMISSIONS, PERMISSION_PRESETS } from "@/lib/permissions";
import { saveUserPermissions } from "@/modules/users/actions";

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "العمل اليومي", keys: ["clients.write", "clients.delete", "txn.write", "txn.delete", "docs.write", "docs.delete", "share.create"] },
  { title: "المال", keys: ["treasury.view", "treasury.write", "reports.view"] },
  { title: "الإدارة", keys: ["settings.manage", "users.manage", "audit.view"] },
];
const LABEL = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.label]));

export function PermissionsEditor({ id, initial }: { id: string; initial: string[] }) {
  const router = useRouter();
  const [on, setOn] = React.useState<Set<string>>(new Set(initial));
  const [pending, start] = React.useTransition();
  const dirty = on.size !== initial.length || initial.some((k) => !on.has(k));
  const toggle = (k: string) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-2 text-sm font-medium text-ink-2">ابدأ من نموذج جاهز ثم عدّل كما تشاء:</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERMISSION_PRESETS) as (keyof typeof PERMISSION_PRESETS)[]).map((k) => (
            <button key={k} type="button" onClick={() => setOn(new Set(PERMISSION_PRESETS[k].keys))} title={PERMISSION_PRESETS[k].hint}
              className="rounded-full border border-line-strong bg-surface px-4 py-2 text-sm font-medium hover:border-navy hover:text-navy">{PERMISSION_PRESETS[k].label}</button>
          ))}
        </div>
      </div>
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="rounded-card border border-line">
          <legend className="ms-3 px-2 text-xs font-bold text-ink-3">{g.title}</legend>
          <ul className="divide-y divide-line">
            {g.keys.map((k) => (
              <li key={k}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 text-[15px] hover:bg-bg">
                  <input type="checkbox" checked={on.has(k)} onChange={() => toggle(k)} className="size-5 accent-navy" />
                  {LABEL[k]}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-3">{dirty ? "هناك تغييرات لم تُحفظ" : "الصلاحيات محفوظة"}</span>
        <Button disabled={pending || !dirty} onClick={() => start(async () => {
          const r = await saveUserPermissions(id, [...on]);
          if (!r.ok) { toast.error(r.error); return; }
          toast.success("تم حفظ الصلاحيات"); router.refresh();
        })}>{pending ? "جارٍ الحفظ..." : "حفظ الصلاحيات"}</Button>
      </div>
    </div>
  );
}
