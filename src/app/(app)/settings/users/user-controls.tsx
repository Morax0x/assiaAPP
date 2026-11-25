"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { ROLE_LABEL } from "@/lib/permissions";
import { updateUserAction } from "@/modules/settings/actions";

export function UserControls({ id, role, active, canSetRole }: { id: string; role: string; active: boolean; canSetRole: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = (patch: { role?: string; is_active?: boolean }) =>
    start(async () => {
      const r = await updateUserAction(id, patch);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("تم التحديث");
      router.refresh();
    });
  return (
    <div className="flex items-center gap-2">
      {canSetRole && (
        <Select value={role} disabled={pending} onChange={(e) => run({ role: e.target.value })} className="h-9 w-auto min-w-32" aria-label="الدور">
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      )}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run({ is_active: !active })}>{active ? "تعطيل" : "تفعيل"}</Button>
    </div>
  );
}
