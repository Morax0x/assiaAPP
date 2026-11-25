import Image from "next/image";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return <Image src="/logo.png" alt="آسيا" width={96} height={100} priority className={cn("logo-img size-8 object-contain", className)} />;
}

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-ink">آسيا</div>
          <div className="text-[11px] text-ink-3">لخدمات رجال الأعمال</div>
        </div>
      )}
    </div>
  );
}
