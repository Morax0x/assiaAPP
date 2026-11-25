"use client";
import { ActionForm } from "@/components/ui/action-form";
import type { Result } from "@/lib/action";

export function NewClientForm({ action, children }: { action: (fd: FormData) => Promise<Result<unknown>>; children: React.ReactNode }) {
  return <ActionForm action={action} submitLabel="إنشاء العميل" resetOnSuccess={false}>{children}</ActionForm>;
}
