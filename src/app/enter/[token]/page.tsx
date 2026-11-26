import { LogoMark } from "@/components/layout/logo";
import { listPeople } from "@/modules/auth/enter";
import { Picker } from "./picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "الدخول إلى آسيا", robots: { index: false, follow: false } };

export default async function EnterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const people = await listPeople(token);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <LogoMark className="mx-auto size-16" />
          <h1 className="mt-4 text-xl font-bold">آسيا لخدمات رجال الأعمال</h1>
        </div>
        {people === null ? (
          <div className="rounded-card border border-line bg-surface p-6 text-center">
            <p className="font-semibold">هذا الرابط لم يعد صالحاً</p>
            <p className="mt-2 text-sm leading-7 text-ink-3">اطلب من المكتب الرابط الجديد المثبّت في المجموعة.</p>
          </div>
        ) : people.length === 0 ? (
          <div className="rounded-card border border-line bg-surface p-6 text-center text-sm text-ink-3">لا يوجد موظفون مضافون بعد.</div>
        ) : (
          <Picker token={token} people={people} />
        )}
      </div>
    </div>
  );
}
