"use client";
import * as React from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfPages } from "@/components/documents/pdf-pages";
import { getSignedUrl } from "@/modules/documents/actions";

/** Shows a document right inside another dialog (used by the edit dialog so the real dates can be checked while editing). */
export function InlineDocPreview({ id }: { id: string }) {
  const [data, setData] = React.useState<{ url: string; mime: string; title: string } | null>(null);
  const [err, setErr] = React.useState("");
  const [pdfFailed, setPdfFailed] = React.useState(false);
  const [touch, setTouch] = React.useState(false);
  const onFail = React.useCallback(() => setPdfFailed(true), []);

  React.useEffect(() => {
    let dead = false;
    setTouch(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);
    getSignedUrl(id).then((r) => {
      if (dead) return;
      if (!r.ok || !r.data) setErr(r.ok ? "تعذر الفتح" : r.error);
      else setData(r.data);
    });
    return () => { dead = true; };
  }, [id]);

  const isPdf = data?.mime === "application/pdf";
  return (
    <div className="h-[38dvh] overflow-hidden rounded-card border border-line bg-bg">
      {err ? (
        <div className="flex h-full items-center justify-center p-4 text-sm text-bad">{err}</div>
      ) : !data ? (
        <div className="skeleton h-full w-full" />
      ) : data.mime.startsWith("image/") ? (
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
  );
}
