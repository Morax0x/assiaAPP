"use client";
import * as React from "react";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getSignedUrl } from "@/modules/documents/actions";

export function DocumentPreviewButton({ id, label = "معاينة" }: { id: string; label?: string }) {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<{ url: string; mime: string; title: string } | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function load() {
    setLoading(true);
    const r = await getSignedUrl(id);
    setLoading(false);
    if (!r.ok || !r.data) return toast.error(r.ok ? "تعذر الفتح" : r.error);
    setData(r.data);
    setOpen(true);
  }

  async function download() {
    const r = await getSignedUrl(id, true);
    if (!r.ok || !r.data) return toast.error(r.ok ? "تعذر التحميل" : r.error);
    window.location.href = r.data.url;
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
        <Eye /> {loading ? "..." : label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={data?.title ?? "معاينة"} className="md:max-w-3xl">
          {data && (
            <div className="space-y-3">
              <div className="h-[65dvh] overflow-hidden rounded-card border border-line bg-bg">
                {data.mime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.url} alt={data.title} className="h-full w-full object-contain" />
                ) : data.mime === "application/pdf" ? (
                  <iframe src={data.url} title={data.title} className="h-full w-full" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-ink-3">لا تتوفر معاينة لهذا النوع، حمّل الملف لفتحه</div>
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={download}><Download /> تحميل</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
