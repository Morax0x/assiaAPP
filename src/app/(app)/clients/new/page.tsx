import { PageHeader, Card } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { ClientFields } from "@/components/clients/client-form";
import { createClientAndGo } from "@/modules/clients/actions";
import { NewClientForm } from "./new-client-form";

export const metadata = { title: "عميل جديد" };

export default async function NewClientPage() {
  await requirePage("clients.write");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="عميل جديد" />
      <Card className="p-4">
        <NewClientForm action={createClientAndGo}>
          <ClientFields />
        </NewClientForm>
      </Card>
    </div>
  );
}
