"use client";
import * as React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title, description, children, className,
}: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <D.Content
        className={cn(
          "fixed z-50 flex max-h-[92dvh] flex-col border border-line bg-surface shadow-lg outline-none",
          "inset-x-0 bottom-0 rounded-t-xl md:inset-auto md:start-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-y-1/2 md:ltr:-translate-x-1/2 md:rtl:translate-x-1/2 md:rounded-card",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <D.Title className="text-[15px] font-semibold text-ink">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-xs text-ink-3">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="rounded-md p-1 text-ink-3 hover:bg-mute-soft" aria-label="إغلاق">
            <X className="size-4" strokeWidth={1.75} />
          </D.Close>
        </div>
        <div className="overflow-y-auto p-4 safe-b">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
