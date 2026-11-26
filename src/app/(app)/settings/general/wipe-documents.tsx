"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { wipeAllDocuments } from "@/modules/documents/actions";

const PHRASE = "حذف كل المستندات";

export function WipeDocuments() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (!open) return <Button variant="danger" onClick={() => setOpen(true)}><Trash2 /> حذف كل المستندات</Button>;
  return (
    <div className="space-y-3 rounded-card border border-bad/40 bg-bad-soft p-3">
      <p className="text-sm leading-7">سيُحذف <b>كل مستند</b> نهائياً من التطبيق ومن مخزن الملفات، ولا يمكن الرجوع عنه. ملفات العملاء نفسها (الأسماء) تبقى. للتأكيد اكتب: <b>{PHRASE}</b></p>
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={PHRASE} />
      <div className="flex gap-2">
        <Button variant="danger" disabled={busy || text.trim() !== PHRASE} onClick={async () => {
          setBusy(true);
          const r = await wipeAllDocuments(text);
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success(`تم حذف ${r.data!.deleted} مستند`);
          setOpen(false); setText(""); router.refresh();
        }}>{busy ? "جارٍ الحذف..." : "احذف نهائياً"}</Button>
        <Button variant="outline" onClick={() => { setOpen(false); setText(""); }}>إلغاء</Button>
      </div>
    </div>
  );
}
