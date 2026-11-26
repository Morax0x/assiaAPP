"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError("window", e.message, e.filename ? `${e.filename}:${e.lineno}` : undefined);
    const onRejection = (e: PromiseRejectionEvent) => { const m = String((e.reason as Error)?.message ?? e.reason); if (m.includes("NEXT_REDIRECT") || m.includes("NEXT_NOT_FOUND")) return; reportError("promise", m); };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
