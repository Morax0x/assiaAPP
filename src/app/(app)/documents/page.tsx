import Link from "next/link";
import { FolderUp, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requirePage } from "@/lib/auth";
import { DocumentsLibrary, type LibDoc } from "./documents-library";

export const metadata = { title: "المستندات" };

export default async function DocumentsPage() {
  const s = await requirePage();
  const supabase = await createClient();
  const [{ data }, { data: types }, { data: os }, { data: allClients }] = await Promise.all([
    supabase.from("documents")
      .select("id,client_id,transaction_id,title,issue_date,expiry_date,mime_type,size_bytes,created_at,folder,tag,document_types(id,name),clients(name,kind,parent_id),transactions(ref_no)")
      .eq("is_current", true).is("deleted_at", null).order("created_at", { ascending: false }).limit(3000),
    supabase.from("document_types").select("id,name").order("sort_order"),
    supabase.from("office_settings").select("critical_days").single(),
    supabase.from("clients").select("id,name,kind,parent_id").is("deleted_at", null).order("name"),
  ]);
  const docs: LibDoc[] = (data ?? []).map((d) => {
    const x = d as unknown as { document_types: { id: string; name: string } | null; clients: { name: string; kind: string; parent_id: string | null } | null; transactions: { ref_no: string } | null };
    return {
      id: d.id, client_id: d.client_id, transaction_id: d.transaction_id, title: d.title, issue_date: d.issue_date, expiry_date: d.expiry_date,
      mime_type: d.mime_type, size_bytes: Number(d.size_bytes), created_at: d.created_at,
      type_id: x.document_types?.id ?? "", type_name: x.document_types?.name ?? "", client_name: x.clients?.name ?? "", client_kind: x.clients?.kind ?? "individual", client_parent_id: x.clients?.parent_id ?? null, folder: (d as { folder?: string | null }).folder ?? null, tag: (d as { tag?: string | null }).tag ?? null, txn_ref: x.transactions?.ref_no ?? null,
    };
  });
  return (
    <>
      <PageHeader
        title="المستندات"
        description={`${docs.length} مستند — كل ملفات العملاء والمعاملات في مكان واحد`}
        actions={s.perms.has("docs.write") && <>{s.perms.has("docs.import") && <Button asChild variant="outline"><Link href="/documents/import"><FolderUp /> رفع مجلد كامل</Link></Button>}<Button asChild><Link href="/documents/new"><Upload /> رفع مستندات</Link></Button></>}
      />
      <DocumentsLibrary docs={docs} types={types ?? []} critical={os?.critical_days ?? 14} canWrite={s.perms.has("docs.write")} canMove={s.perms.has("docs.move")} canDelete={s.perms.has("docs.delete")} canOpen={s.perms.has("docs.open")} moveTargets={(allClients ?? []).map((c) => ({ id: c.id as string, name: c.name as string, kind: c.kind as string, parent_id: (c.parent_id ?? null) as string | null }))} />
    </>
  );
}
