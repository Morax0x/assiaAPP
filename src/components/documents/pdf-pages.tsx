"use client";
import * as React from "react";

/** Draws every page of a PDF as an image, so it can be previewed on a phone where iframes do not show PDFs. */
export function PdfPages({ src, onFail }: { src: string; onFail: () => void }) {
  const box = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<"loading" | "ok">("loading");
  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const pdf = await pdfjs.getDocument({ url: src }).promise;
        const width = Math.min(box.current?.clientWidth ?? 360, 900);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
          if (dead) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width; canvas.height = vp.height;
          canvas.style.width = "100%"; canvas.style.height = "auto"; canvas.className = "mb-2 rounded border border-line bg-white";
          await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
          if (dead) return;
          box.current?.appendChild(canvas);
          if (i === 1) setState("ok");
        }
      } catch { if (!dead) onFail(); }
    })();
    return () => { dead = true; };
  }, [src, onFail]);
  return (
    <div className="h-full overflow-y-auto p-2">
      {state === "loading" && <div className="py-10 text-center text-sm text-ink-3">جارٍ تحميل المعاينة...</div>}
      <div ref={box} />
    </div>
  );
}
