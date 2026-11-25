"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setQuoteStatus } from "@/modules/quotes/actions";

const OPTIONS = [
  { key: "sent", label: "أرسلتُه للعميل" },
  { key: "rejected", label: "رفض العميل" },
  { key: "draft", label: "إعادته مسودة" },
];

export function QuoteStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.filter((o) => o.key !== status).map((o) => (
        <Button key={o.key} size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
          const r = await setQuoteStatus(id, o.key);
          if (!r.ok) { toast.error(r.error); return; }
          toast.success("تم التحديث"); router.refresh();
        })}>{o.label}</Button>
      ))}
    </div>
  );
}
