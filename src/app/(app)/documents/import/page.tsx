import { PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { BulkImport } from "./bulk-import";

export const metadata = { title: "رفع ملفاتك الحالية" };

export default async function ImportPage() {
  await requirePage("docs.write");
  const supabase = await createClient();
  const [{ data: clients }, { data: types }] = await Promise.all([
    supabase.from("clients").select("id,name,kind").is("deleted_at", null).order("name"),
    supabase.from("document_types").select("id,name").order("sort_order"),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/documents", label: "رجوع للمستندات" }}
        title="رفع ملفاتك الحالية دفعة واحدة"
        description="اختر مجلداً من جهازك فتُرفع كل ملفاته بنفس ترتيب مجلداته. ضع تصنيفاً (مكان أو جهة) ليسهل البحث بعدها."
      />
      <BulkImport clients={clients ?? []} types={types ?? []} />
    </div>
  );
}
