"use client";
import * as React from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPaymentReceiptUrl } from "@/modules/transactions/actions";
import { getReceiptUrl } from "@/modules/treasury/actions";

/** Opens an attached receipt through a short-lived signed link. */
export function ReceiptButton({ entryId, kind = "payment" }: { entryId: string; kind?: "payment" | "ledger" }) {
  const [busy, setBusy] = React.useState(false);
  async function open() {
    setBusy(true);
    const r = kind === "payment" ? await getPaymentReceiptUrl(entryId) : await getReceiptUrl(entryId);
    setBusy(false);
    if (!r.ok || !r.data) return toast.error(r.ok ? "تعذر الفتح" : r.error);
    window.open(r.data.url, "_blank", "noopener");
  }
  return <Button size="sm" variant="outline" disabled={busy} onClick={open}><Paperclip /> الإيصال</Button>;
}
