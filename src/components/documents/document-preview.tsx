"use client";
import * as React from "react";
import Link from "next/link";
import { Download, ExternalLink, Eye, UserPen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ActionDialog } from "@/components/ui/action-form";
import { ClientFields } from "@/components/clients/client-form";
import { PdfPages } from "@/components/documents/pdf-pages";
import { getDocumentClient, getSignedUrl } from "@/modules/documents/actions";
import { updateClientAction } from "@/modules/clients/actions";

type ClientInfo = { client: { id: string; kind: string; name: string; phone: string | null; whatsapp: string | null; email: string | null; notes: string | null; parent_id: string | null }; companies: { id: string; name: string }[]; canEdit: boolean };

export function DocumentPreviewButton({ id, label = "معاينة" }: { id: string; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<{ url: string; mime: string; title: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [info, setInfo] = React.useState<ClientInfo | null>(null);
  const [pdfFailed, setPdfFailed] = React.useState(false);
  const [touch, setTouch] = React.useState(false);
  const onFail = React.useCallback(() => setPdfFailed(true), []);

  async function load() {
    setLoading(true); setPdfFailed(false); setInfo(null);
    setTouch(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);
    const r = await getSignedUrl(id);
    setLoading(false);
    if (!r.ok || !r.data) return toast.error(r.ok ? "تعذر الفتح" : r.error);
    setData(r.data);
    setOpen(true);
    getDocumentClient(id).then((c) => { if (c.ok && c.data) setInfo(c.data as ClientInfo); });
  }

  async function download() {
    const r = await getSignedUrl(id, true);
    if (!r.ok || !r.data) return toast.error(r.ok ? "تعذر التحميل" : r.error);
    window.location.href = r.data.url;
  }

  const isPdf = data?.mime === "application/pdf";
  return (
    <>
      <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
        <Eye /> {loading ? "..." : label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={data?.title ?? "معاينة"} className="md:max-w-3xl">
          {data && (
            <div className="space-y-3 overflow-y-auto p-4">
              {info && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-bg px-3 py-2 text-sm">
                  <Link href={`/clients/${info.client.id}`} className="font-semibold text-navy hover:underline" dir="auto">{info.client.name}</Link>
                  {info.canEdit && (
                    <ActionDialog trigger={<><UserPen /> تعديل بيانات العميل</>} triggerProps={{ size: "sm", variant: "outline", type: "button" }} title="تعديل بيانات العميل" action={updateClientAction.bind(null, info.client.id)}>
                      <ClientFields v={info.client} companies={info.companies} />
                    </ActionDialog>
                  )}
                </div>
              )}
              <div className="h-[60dvh] overflow-hidden rounded-card border border-line bg-bg">
                {data.mime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.url} alt={data.title} className="h-full w-full object-contain" />
                ) : isPdf && touch && !pdfFailed ? (
                  <PdfPages src={`/api/doc/${id}`} onFail={onFail} />
                ) : isPdf && !touch ? (
                  <iframe src={data.url} title={data.title} className="h-full w-full" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-ink-3">
                    {isPdf ? "تعذرت المعاينة داخل الصفحة" : "لا تتوفر معاينة لهذا النوع"}
                    <Button asChild><a href={data.url} target="_blank" rel="noreferrer"><ExternalLink /> فتح الملف</a></Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button asChild variant="outline"><a href={data.url} target="_blank" rel="noreferrer"><ExternalLink /> فتح في صفحة جديدة</a></Button>
                <Button variant="outline" onClick={download}><Download /> تحميل</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
