import { PageHeader, Card } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientFields } from "@/components/clients/client-form";
import { createClientAndGo } from "@/modules/clients/actions";
import { NewClientForm } from "./new-client-form";

export const metadata = { title: "عميل جديد" };

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ kind?: string; parent?: string }> }) {
  await requirePage("clients.write");
  const { kind, parent } = await searchParams;
  const { data: companies } = await (await createClient()).from("clients").select("id,name").eq("kind", "company").is("deleted_at", null).order("name");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="عميل جديد" description="اكتب الاسم ورقم الهاتف فقط، والباقي اختياري. يمكنك تعديله لاحقاً." back={{ href: "/clients", label: "رجوع للعملاء" }} />
      <Card className="p-4">
        <NewClientForm action={createClientAndGo}>
          <ClientFields companies={companies ?? []} v={{ kind: kind === "company" || kind === "sponsor" ? kind : "individual", parent_id: parent ?? null }} />
        </NewClientForm>
      </Card>
    </div>
  );
}
