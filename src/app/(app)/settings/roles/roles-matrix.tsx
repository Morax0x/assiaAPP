"use client";
import * as React from "react";
import { toast } from "sonner";
import { setRolePermission } from "@/modules/settings/actions";
import { ROLE_LABEL } from "@/lib/permissions";

export function RolesMatrix({ perms, initial }: { perms: { key: string; label: string }[]; initial: Record<string, boolean> }) {
  const [state, setState] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function toggle(role: "admin" | "staff", key: string, next: boolean) {
    const k = `${role}:${key}`;
    setBusy(k);
    setState((s) => ({ ...s, [k]: next }));
    const r = await setRolePermission(role, key, next);
    setBusy(null);
    if (!r.ok) { setState((s) => ({ ...s, [k]: !next })); toast.error(r.error); }
  }

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-ink-3">
            <th className="py-2 text-start font-medium">الصلاحية</th>
            <th className="w-24 py-2 text-center font-medium">{ROLE_LABEL.owner}</th>
            <th className="w-24 py-2 text-center font-medium">{ROLE_LABEL.admin}</th>
            <th className="w-24 py-2 text-center font-medium">{ROLE_LABEL.staff}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {perms.map((p) => (
            <tr key={p.key}>
              <td className="py-2.5">{p.label}</td>
              <td className="text-center"><input type="checkbox" checked disabled className="size-4 accent-navy" aria-label="مالك" /></td>
              {(["admin", "staff"] as const).map((role) => (
                <td key={role} className="text-center">
                  <input
                    type="checkbox" className="size-4 accent-navy" checked={!!state[`${role}:${p.key}`]} disabled={busy === `${role}:${p.key}`}
                    onChange={(e) => toggle(role, p.key, e.target.checked)} aria-label={`${ROLE_LABEL[role]} - ${p.label}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
