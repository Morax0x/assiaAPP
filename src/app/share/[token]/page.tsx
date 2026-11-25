import { FileText, ShieldAlert } from "lucide-react";
import { resolveShare } from "@/lib/share-access";
import { LogoMark } from "@/components/layout/logo";
import { PinForm } from "./pin-form";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "مستندات مشاركة", robots: { index: false, follow: false } };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await resolveShare(token, { count: true });

  return (
    <div className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="text-base font-semibold">{r.state === "ok" && r.officeName ? r.officeName : "آسيا لخدمات رجال الأعمال"}</span>
        </div>

        {r.state === "invalid" && (
          <div className="rounded-card border border-line bg-surface p-8 text-center">
            <ShieldAlert className="mx-auto mb-3 size-8 text-ink-3" strokeWidth={1.5} />
            <p className="font-medium">هذا الرابط غير صالح أو انتهت صلاحيته</p>
            <p className="mt-1 text-sm text-ink-3">يرجى التواصل مع المكتب للحصول على رابط جديد.</p>
          </div>
        )}

        {r.state === "pin" && (
          <div className="rounded-card border border-line bg-surface p-6">
            <p className="mb-4 text-center text-sm text-ink-2">هذا الرابط محمي برمز سري. أدخل الرمز الذي وصلك من المكتب.</p>
            <PinForm token={token} locked={r.locked} />
          </div>
        )}

        {r.state === "ok" && (
          <div className="rounded-card border border-line bg-surface">
            <div className="border-b border-line px-4 py-4">
              <div className="text-xs text-ink-3">{r.clientName}</div>
              <h1 className="mt-0.5 text-base font-semibold">{r.heading}</h1>
            </div>
            {r.docs.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-3">لا توجد مستندات متاحة</p>
            ) : (
              <ul className="divide-y divide-line">
                {r.docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3.5">
                    <FileText className="size-5 shrink-0 text-ink-3" strokeWidth={1.5} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{d.title}</div>
                      <div className="text-xs text-ink-3">{d.type_name}{d.expiry_date ? <> · ينتهي <span className="num">{fmtDate(d.expiry_date)}</span></> : null}</div>
                    </div>
                    <a href={`/api/share/${token}/file?doc=${d.id}`} target="_blank" rel="noreferrer" className="rounded-ctl border border-line-strong px-3 py-1.5 text-sm hover:bg-bg">عرض</a>
                    {r.link.allow_download && (
                      <a href={`/api/share/${token}/file?doc=${d.id}&download=1`} className="rounded-ctl bg-navy px-3 py-1.5 text-sm text-white hover:bg-navy-hover">تحميل</a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-ink-3">للعرض فقط · هذه الصفحة خاصة بمن وصله الرابط</p>
      </div>
    </div>
  );
}
