import { PageHeader } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { ServicesBoard, type Service } from "./services-board";

export const metadata = { title: "الخدمات والأسعار" };

export default async function ServicesPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const { data } = await supabase.from("service_templates").select("id,name,name_en,category,default_govt_fee,default_office_fee").eq("is_active", true).order("name");
  const rows: Service[] = (data ?? []).map((r) => ({
    id: r.id, name: r.name, name_en: r.name_en ?? "", category: r.category ?? "خدمات أخرى",
    govt: Number(r.default_govt_fee), fee: Number(r.default_office_fee),
  }));
  return (
    <>
      <PageHeader
        title="الخدمات والأسعار"
        description="قائمة الخدمات التي يقدمها المكتب مع أسعارها. تظهر هنا عند إنشاء فاتورة أو عرض سعر فتمتلئ الأسعار تلقائياً، ويمكنك دائماً كتابة بند يدوي مختلف."
      />
      <ServicesBoard rows={rows} canEdit={s.perms.has("services.manage")} />
    </>
  );
}
