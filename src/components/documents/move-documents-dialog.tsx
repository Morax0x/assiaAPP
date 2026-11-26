"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/form";
import { listClientTransactions, moveDocuments } from "@/modules/documents/actions";
import { CLIENT_KIND_PLURAL } from "@/lib/permissions";

export type MoveTarget = { id: string; name: string; kind: string; parent_id: string | null };

/** Move documents (with their older versions) to another client, an employee inside a company, or a specific transaction. */
export function MoveDocumentsDialog({
  ids, currentClientId, targets, onDone, label, iconOnly,
}: { ids: string[]; currentClientId: string; targets: MoveTarget[]; onDone?: () => void; label?: string; iconOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [target, setTarget] = React.useState("");
  const [txn, setTxn] = React.useState("");
  const [txns, setTxns] = React.useState<{ id: string; label: string }[]>([]);
  const [busy, setBusy] = React.useState(false);

  const nameOf = React.useMemo(() => new Map(targets.map((t) => [t.id, t.name])), [targets]);
  const groups = React.useMemo(() => {
    const list = targets.filter((t) => t.id !== currentClientId);
    return (["company", "individual", "sponsor"] as const)
      .map((k) => ({ k, items: list.filter((t) => t.kind === k).sort((a, b) => a.name.localeCompare(b.name, "ar")) }))
      .filter((g) => g.items.length);
  }, [targets, currentClientId]);

  React.useEffect(() => {
    setTxn(""); setTxns([]);
    if (!target) return;
    listClientTransactions(target).then((r) => { if (r.ok) setTxns(r.data ?? []); });
  }, [target]);

  async function go() {
    if (!target) return toast.error("اختر العميل الذي ستنقل إليه");
    setBusy(true);
    const r = await moveDocuments(ids, target, txn || null);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`تم نقل ${r.data?.moved ?? ids.length} مستند إلى ${nameOf.get(target) ?? "العميل"}`);
    setOpen(false); setTarget("");
    onDone?.();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={iconOnly ? "ghost" : "outline"} size={iconOnly ? "icon" : "sm"} disabled={!ids.length} aria-label="نقل" title="نقل إلى عميل آخر"><ArrowRightLeft />{!iconOnly && ` ${label ?? "نقل"}`}</Button>
      </DialogTrigger>
      <DialogContent title={`نقل ${ids.length} مستند`} description="تنتقل المستندات مع نسخها القديمة، ولا يُحذف شيء.">
        <div className="space-y-4">
          <Field label="انقل إلى">
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">— اختر العميل أو الشركة أو الموظف —</option>
              {groups.map((g) => (
                <optgroup key={g.k} label={CLIENT_KIND_PLURAL[g.k]}>
                  {g.items.map((t) => <option key={t.id} value={t.id}>{t.name}{t.parent_id ? ` (موظف في ${nameOf.get(t.parent_id) ?? "شركة"})` : ""}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
          {target && (
            <Field label="ربطها بمعاملة (اختياري)">
              <Select value={txn} onChange={(e) => setTxn(e.target.value)}>
                <option value="">بدون معاملة (ملف عام)</option>
                {txns.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
          )}
          <div className="flex justify-end"><Button onClick={go} disabled={busy || !target}>{busy ? "جارٍ النقل..." : "نقل الآن"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
