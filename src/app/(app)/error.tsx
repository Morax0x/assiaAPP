"use client";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto mt-16 max-w-md rounded-card border border-line bg-surface p-8 text-center">
      <TriangleAlert className="mx-auto mb-3 size-9 text-orange" strokeWidth={1.5} />
      <h1 className="text-lg font-semibold">حدثت مشكلة غير متوقعة</h1>
      <p className="mt-2 text-sm text-ink-3">لم يتأثر أي من بياناتك. جرّب إعادة المحاولة، وإن تكررت المشكلة تواصل مع المسؤول.</p>
      {error.digest && <p className="mt-2 text-xs text-ink-3 num">رمز الخطأ: {error.digest}</p>}
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={reset}>إعادة المحاولة</Button>
        <Button variant="outline" asChild><a href="/dashboard">الرئيسية</a></Button>
      </div>
    </div>
  );
}
