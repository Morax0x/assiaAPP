import { PageHeader, Card } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { ClientFields } from "@/components/clients/client-form";
import { createClientAndGo } from "@/modules/clients/actions";
import { NewClientForm } from "./new-client-form";

export const metadata = { title: "عميل جديد" };

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requirePage("clients.write");
  const { kind } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="عميل جديد" description="اكتب الاسم ورقم الهاتف فقط، والباقي اختياري. يمكنك تعديله لاحقاً." back={{ href: "/clients", label: "رجوع للعملاء" }} />
      <Card className="p-4">
        <NewClientForm action={createClientAndGo}>
          <ClientFields v={{ kind: kind === "company" || kind === "sponsor" ? kind : "individual" }} />
        </NewClientForm>
      </Card>
    </div>
  );
}
