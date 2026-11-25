"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select } from "@/components/ui/form";
import { TXN_STATUS_LABEL } from "@/lib/permissions";
import { setTransactionStatus } from "@/modules/transactions/actions";

export function StatusSelect({ id, status, disabled }: { id: string; status: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Select
      value={status} disabled={disabled || pending} className="h-9 w-auto min-w-36" aria-label="حالة المعاملة"
      onChange={(e) => start(async () => {
        const r = await setTransactionStatus(id, e.target.value);
        if (!r.ok) { toast.error(r.error); return; }
        toast.success("تم تحديث الحالة");
        router.refresh();
      })}
    >
      {Object.entries(TXN_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </Select>
  );
}
