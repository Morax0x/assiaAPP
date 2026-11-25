import { PageHeader } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { SmartSearch } from "./smart-search";

export const metadata = { title: "البحث الذكي" };

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
      <PageHeader title="البحث الذكي" description="اكتب أو تكلّم بالعربية: عميل، معاملة، مستند، فاتورة، مبلغ، أو سؤال مثل «كم المستحق على محمد؟»" />
      <SmartSearch initialQuery={q ?? ""} examples={examples} />
    </>
  );
}
