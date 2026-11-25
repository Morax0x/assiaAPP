import { PageHeader } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { SmartSearch } from "./smart-search";

export const metadata = { title: "البحث" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requirePage();
  const { q } = await searchParams;
  const money = s.perms.has("treasury.view");
  const examples = [
    "عملاء عليهم مستحقات",
    "مستندات تنتهي هذا الشهر",
    "الإقامات المنتهية",
    "معاملات قيد الإجراء",
    "معاملات غير مدفوعة",
    "رخصة تجارية تنتهي خلال 60 يوم",
    ...(money ? ["رصيد الكاش", "مصاريف هذا الشهر", "مصاريف الإيجار الشهر الماضي"] : []),
  ];
  return (
    <>
      <PageHeader title="بحث بالكتابة أو الصوت" description="اكتب بكلماتك العادية، أو اضغط الميكروفون وتحدث. مثلاً: «كم المتبقي على محمد» أو «الإقامات التي تنتهي هذا الشهر»." />
      <SmartSearch initialQuery={q ?? ""} examples={examples} />
    </>
  );
}
