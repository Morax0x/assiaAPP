"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { Result } from "@/lib/action";

type Action = (fd: FormData) => Promise<Result<unknown>>;

/** A form wired to a server action: pending state, toast, refresh. */
export function ActionForm({
  action, children, submitLabel = "حفظ", onSuccess, className, resetOnSuccess = true,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  onSuccess?: (data: unknown) => void;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const ref = React.useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className ?? "space-y-4"}
      action={(fd) =>
        start(async () => {
          const r = await action(fd);
          if (!r.ok) { toast.error(r.error); return; }
          toast.success("تم الحفظ");
          if (resetOnSuccess) ref.current?.reset();
          onSuccess?.(r.data);
          router.refresh();
        })
      }
    >
      {children}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "جارٍ الحفظ..." : submitLabel}</Button>
      </div>
    </form>
  );
}

export function ActionDialog({
  trigger, title, description, action, submitLabel, children, defaultOpen, triggerProps,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  action: Action;
  submitLabel?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  triggerProps?: ButtonProps;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" {...triggerProps}>{trigger}</Button>
      </DialogTrigger>
      <DialogContent title={title} description={description}>
        <ActionForm action={action} submitLabel={submitLabel} onSuccess={() => setOpen(false)}>
          {children}
          <DialogClose className="sr-only">إغلاق</DialogClose>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
