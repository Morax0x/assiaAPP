"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { restoreRecord } from "@/modules/settings/trash";

export function RestoreButton({ table, id }: { table: "clients" | "transactions" | "documents"; id: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      size="sm" variant="outline" disabled={pending}
      onClick={() => start(async () => {
        const r = await restoreRecord(table, id);
        if (!r.ok) { toast.error(r.error); return; }
        toast.success("تم الاسترجاع");
        router.refresh();
      })}
    >
      <Undo2 /> استرجاع
    </Button>
  );
}
