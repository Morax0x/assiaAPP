import { LoginForm } from "./login-form";
import { LogoMark } from "@/components/layout/logo";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogoMark className="size-12" />
          <div>
            <h1 className="text-xl font-semibold">آسيا لخدمات رجال الأعمال</h1>
            <p className="mt-1 text-sm text-ink-3">دخول المالك والمدير</p>
          </div>
        </div>
        <div className="rounded-card border border-line bg-surface p-5">
          <LoginForm next={next ?? "/dashboard"} />
        </div>
        <p className="mt-4 rounded-card border border-line bg-surface px-4 py-3 text-center text-sm leading-7 text-ink-2">
          <b>موظف؟</b> لا تحتاج بريداً ولا كلمة مرور. افتح الرابط الذي ثبّته المكتب في مجموعة الموظفين، واختر اسمك.
        </p>
      </div>
    </div>
  );
}
