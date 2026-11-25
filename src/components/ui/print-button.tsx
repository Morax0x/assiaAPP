"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "طباعة / حفظ PDF" }: { label?: string }) {
  return <Button variant="outline" onClick={() => window.print()}><Printer /> {label}</Button>;
}
