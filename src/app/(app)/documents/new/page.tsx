import { Card, PageHeader } from "@/components/ui/card";
import { requirePage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DocumentUploader } from "@/components/documents/document-uploader";

export const metadata = { title: "رفع مستند" };

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ client?: string; folder?: string }> }) {
  await requirePage("docs.write");
  const { client, folder } = await searchParams;
  const supabase = await createClient();
  const [{ data: clients }, { data: types }] = await Promise.all([
    supabase.from("clients").select("id,name,kind").is("deleted_at", null).order("name"),
    supabase.from("document_types").select("id,name").order("sort_order"),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/documents", label: "رجوع للمستندات" }} title="رفع مستندات" description="يمكن رفع عدة ملفات دفعة واحدة أو تصويرها بالكاميرا" />
      <Card className="p-4">
        <DocumentUploader types={types ?? []} clients={clients ?? []} clientId={client} folder={folder} />
      </Card>
    </div>
  );
}
