"use client";
import * as React from "react";
import Link from "next/link";
import { FileText, FolderOpen, Landmark, Loader2, Mic, MicOff, Search, Sparkles, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, Empty } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { smartSearch, type SmartResult } from "@/modules/search/smart";
import { cn } from "@/lib/utils";

type SR = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; start(): void; stop(): void;
};
type SRCtor = new () => SR;

const ICON = { clients: Users, transactions: FileText, documents: FolderOpen, ledger: Landmark } as const;

export function SmartSearch({ initialQuery, examples }: { initialQuery: string; examples: string[] }) {
  const [q, setQ] = React.useState(initialQuery);
  const [res, setRes] = React.useState<SmartResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const [supported, setSupported] = React.useState(false);
  const recRef = React.useRef<SR | null>(null);
  const reqId = React.useRef(0);

  const run = React.useCallback(async (text: string) => {
    const t = text.trim();
    if (t.length < 2) { setRes(null); return; }
    const id = ++reqId.current;
    setLoading(true);
    try {
      const r = await smartSearch(t);
      if (id === reqId.current) setRes(r);
    } catch { toast.error("تعذر تنفيذ البحث"); } finally { if (id === reqId.current) setLoading(false); }
  }, []);

  React.useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    if (initialQuery) run(initialQuery);
  }, [initialQuery, run]);

  // live search while typing
  React.useEffect(() => {
    const t = setTimeout(() => { if (q.trim().length >= 2) run(q); }, 450);
    return () => clearTimeout(t);
  }, [q, run]);

  function toggleVoice() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return toast.error("المتصفح لا يدعم البحث الصوتي. جرّب Chrome أو Safari.");
    const rec = new Ctor();
    rec.lang = "ar-AE"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      const text = r[0].transcript;
      setQ(text);
      if (r.isFinal) run(text);
    };
    rec.onerror = (e) => {
      setListening(false);
      toast.error(e.error === "not-allowed" ? "اسمح للمتصفح باستخدام الميكروفون" : e.error === "no-speech" ? "لم أسمع شيئاً، حاول مرة أخرى" : "تعذر التعرف على الصوت");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
          <Input
            value={q} onChange={(e) => setQ(e.target.value)} autoFocus
            placeholder={listening ? "أستمع إليك..." : "ابحث بالكتابة أو بالصوت..."}
            className="h-12 ps-9 pe-9 text-[15px]"
          />
          {q && (
            <button type="button" onClick={() => { setQ(""); setRes(null); }} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-3 hover:bg-mute-soft" aria-label="مسح">
              <X className="size-4" />
            </button>
          )}
        </div>
        {supported && (
          <Button type="button" variant={listening ? "accent" : "outline"} className="h-12 w-12 shrink-0 p-0" onClick={toggleVoice} aria-label="بحث صوتي" title="بحث صوتي">
            {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </Button>
        )}
      </form>

      {listening && (
        <div className="flex items-center gap-2 rounded-ctl bg-orange-soft px-3 py-2 text-sm text-orange-hover">
          <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-orange opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-orange" /></span>
          تحدّث الآن بالعربية...
        </div>
      )}

      {!res && !loading && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-2"><Sparkles className="size-4 text-orange" strokeWidth={1.75} /> جرّب أن تكتب أو تقول</div>
          <div className="flex flex-wrap gap-2">
            {examples.map((e) => (
              <button key={e} onClick={() => { setQ(e); run(e); }} className="rounded-full border border-line bg-bg px-3 py-1.5 text-[13px] text-ink-2 hover:border-navy hover:text-navy">{e}</button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-ink-3">
            يفهم البحث الأسماء وأرقام المعاملات والهواتف، وأنواع المستندات (إقامة، رخصة…)، والحالات (قيد الإجراء، مكتملة…)، والمستحقات، والفترات الزمنية (هذا الشهر، خلال 30 يوم، الشهر الماضي)، والمبالغ (أكثر من 1000).
          </p>
        </Card>
      )}

      {loading && <div className="flex items-center gap-2 text-sm text-ink-3"><Loader2 className="size-4 animate-spin" /> جارٍ البحث...</div>}

      {res && (
        <div className={cn("space-y-4", loading && "opacity-60")}>
          {res.chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
              <span>فهمتُ:</span>
              {res.chips.map((c) => <Badge key={c} tone="navy">{c}</Badge>)}
            </div>
          )}
          {res.answers.length > 0 && (
            <Card className="border-navy/30 bg-navy-soft p-4">
              <ul className="space-y-1 text-sm font-medium text-navy">{res.answers.map((a) => <li key={a}><span className="num">{a}</span></li>)}</ul>
            </Card>
          )}
          {res.empty ? (
            <Card><Empty icon={<Search />} title="لا توجد نتائج مطابقة" hint="جرّب كلمات أقل أو اسم العميل فقط" /></Card>
          ) : (
            res.sections.map((sec) => {
              const Icon = ICON[sec.key as keyof typeof ICON] ?? FileText;
              return (
                <Card key={sec.key}>
                  <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold">
                    <Icon className="size-4 text-navy" strokeWidth={1.75} /> {sec.title}
                    <span className="rounded-full bg-mute-soft px-2 text-xs font-medium text-ink-2 num">{sec.count}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {sec.items.map((it) => (
                      <li key={sec.key + it.id}>
                        <Link href={it.href} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-bg">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{it.title}</div>
                            {it.sub && <div className="truncate text-xs text-ink-3">{it.sub}</div>}
                          </div>
                          {it.meta && <span className="text-sm text-ink-2 num">{it.meta}</span>}
                          {it.badge && <Badge tone={it.badge.tone}>{it.badge.label}</Badge>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {sec.count > sec.items.length && <div className="border-t border-line px-4 py-2 text-xs text-ink-3">يُعرض أول {sec.items.length} من {sec.count} — أضف كلمات لتضييق البحث</div>}
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
