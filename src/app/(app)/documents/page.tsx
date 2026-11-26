import Link from "next/link";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { DocumentsLibrary, type LibDoc } from "./documents-library";

export const metadata = { title: "المستندات" };

export default async function DocumentsPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const [{ data }, { data: types }, { data: os }] = await Promise.all([
    supabase.from("documents")
      .select("id,client_id,transaction_id,title,issue_date,expiry_date,mime_type,size_bytes,created_at,document_types(id,name),clients(name,kind),transactions(ref_no)")
      .eq("is_current", true).is("deleted_at", null).order("created_at", { ascending: false }).limit(3000),
    supabase.from("document_types").select("id,name").order("sort_order"),
    supabase.from("office_settings").select("critical_days").single(),
  ]);
  const docs: LibDoc[] = (data ?? []).map((d) => {
    const x = d as unknown as { document_types: { id: string; name: string } | null; clients: { name: string; kind: string } | null; transactions: { ref_no: string } | null };
    return {
      id: d.id, client_id: d.client_id, transaction_id: d.transaction_id, title: d.title, issue_date: d.issue_date, expiry_date: d.expiry_date,
      mime_type: d.mime_type, size_bytes: Number(d.size_bytes), created_at: d.created_at,
      type_id: x.document_types?.id ?? "", type_name: x.document_types?.name ?? "", client_name: x.clients?.name ?? "", client_kind: x.clients?.kind ?? "individual", txn_ref: x.transactions?.ref_no ?? null,
    };
  });
  return (
    <>
      <PageHeader
        title="المستندات"
        description={`${docs.length} مستند — كل ملفات العملاء والمعاملات في مكان واحد`}
        actions={s.perms.has("docs.write") && <Button asChild><Link href="/documents/new"><Upload /> رفع مستندات</Link></Button>}
      />
      <DocumentsLibrary docs={docs} types={types ?? []} critical={os?.critical_days ?? 14} />
    </>
  );
}
