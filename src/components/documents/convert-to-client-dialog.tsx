"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { convertToClient } from "@/modules/documents/actions";

/** Turns the chosen documents into a brand-new client file: pick the name and type, and they move into it. */
export function ConvertToClientDialog({
  ids, defaultName = "", companies = [], label = "تحويل إلى ملف عميل", onDone, variant = "outline", size = "sm",
}: {
  ids: string[]; defaultName?: string; companies?: { id: string; name: string }[]; label?: string; onDone?: () => void;
  variant?: "outline" | "ghost" | "primary"; size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(defaultName);
  const [kind, setKind] = React.useState<"individual" | "company" | "sponsor">("individual");
  const [parent, setParent] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await convertToClient(ids, name, kind, parent || null);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(r.data!.created ? `أُنشئ ملف «${name.trim()}» ونُقل إليه ${r.data!.moved} مستند` : `نُقل ${r.data!.moved} مستند إلى ملف «${name.trim()}» الموجود`);
    setOpen(false);
    onDone?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setName(defaultName); }}>
      <DialogTrigger asChild><Button type="button" variant={variant} size={size}><UserPlus /> {label}</Button></DialogTrigger>
      <DialogContent title="تحويل إلى ملف عميل" description={`${ids.length} مستند سينتقل إلى ملف العميل الجديد`}>
        <form onSubmit={go} className="space-y-3">
          <Field label="اسم العميل / الملف"><Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoFocus /></Field>
          <Field label="النوع">
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="individual">فرد</option><option value="company">شركة</option><option value="sponsor">كفيل</option>
            </Select>
          </Field>
          {kind !== "company" && companies.length > 0 && (
            <Field label="يتبع شركة (اختياري)" hint="مثلاً موظف داخل ملف شركة">
              <Select value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">لا يتبع شركة</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "جارٍ التحويل..." : "حوّل"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
