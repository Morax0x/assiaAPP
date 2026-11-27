"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { createFolder, ensureClient } from "@/modules/documents/actions";

/**
 * "New folder" inside a client's folder. On a company's top level it can also create an employee
 * (a client file under the company); everywhere else it makes a plain sub-folder.
 */
export function NewFolderDialog({ clientId, parentPath, canAddEmployee, canCreateClient }: { clientId: string; parentPath: string; canAddEmployee: boolean; canCreateClient: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [as, setAs] = React.useState<"folder" | "employee">("folder");
  const [busy, setBusy] = React.useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = as === "employee" ? await ensureClient(name, "individual", clientId) : await createFolder(clientId, parentPath, name);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(as === "employee" ? `أُضيف الموظف «${name.trim()}»` : `أُنشئ المجلد «${name.trim()}»`);
    setName(""); setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" variant="outline" size="sm"><FolderPlus /> مجلد جديد</Button></DialogTrigger>
      <DialogContent title="مجلد جديد" description={parentPath ? `داخل «${parentPath.split("/").join(" › ")}»` : "داخل هذا الملف"}>
        <form onSubmit={go} className="space-y-3">
          {canAddEmployee && canCreateClient && (
            <Field label="نوع المجلد">
              <Select value={as} onChange={(e) => setAs(e.target.value as "folder" | "employee")}>
                <option value="folder">مجلد عادي (مثل: عقود، فواتير)</option>
                <option value="employee">موظف (له ملف ومستندات خاصة)</option>
              </Select>
            </Field>
          )}
          <Field label={as === "employee" ? "اسم الموظف" : "اسم المجلد"}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>
          <div className="flex justify-end"><Button type="submit" disabled={busy || !name.trim()}>{busy ? "..." : "إنشاء"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
