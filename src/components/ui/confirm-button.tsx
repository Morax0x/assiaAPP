"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";

/** Opens a confirm dialog, then runs a server action. */
export function ConfirmButton({
  action, title, message, confirmLabel = "تأكيد", children, onDone, ...btn
}: {
  action: () => Promise<{ ok: boolean; error?: string } | void>;
  title: string;
  message: string;
  confirmLabel?: string;
  children: React.ReactNode;
  onDone?: () => void;
} & Omit<ButtonProps, "onClick">) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...btn}>{children}</Button>
      </DialogTrigger>
      <DialogContent title={title}>
        <p className="mb-4 text-sm text-ink-2">{message}</p>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline">إلغاء</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await action();
                if (r && !r.ok) { toast.error(r.error ?? "تعذر التنفيذ"); return; }
                setOpen(false);
                toast.success("تم");
                onDone?.();
                router.refresh();
              })
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
