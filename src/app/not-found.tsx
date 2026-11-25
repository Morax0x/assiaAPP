import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md rounded-card border border-line bg-surface p-8 text-center">
        <SearchX className="mx-auto mb-3 size-9 text-ink-3" strokeWidth={1.5} />
        <h1 className="text-lg font-semibold">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-ink-3">ربما حُذف السجل أو الرابط غير صحيح.</p>
        <Link href="/dashboard" className="mt-5 inline-flex h-11 items-center rounded-ctl bg-navy px-5 text-[15px] font-medium text-white hover:bg-navy-hover">العودة للرئيسية</Link>
      </div>
    </div>
  );
}
