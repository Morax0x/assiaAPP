"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import { FileText, FolderOpen, Search, Users } from "lucide-react";
import { searchAll, type SearchHit } from "@/modules/search/actions";

const ICON = { client: Users, transaction: FileText, document: FolderOpen } as const;
const GROUP = { client: "العملاء", transaction: "المعاملات", document: "المستندات" } as const;

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) { setHits([]); return; }
      setLoading(true);
      try { setHits(await searchAll(q)); } finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => { if (!open) { setQ(""); setHits([]); } }, [open]);

  const groups = (["client", "transaction", "document"] as const).map((g) => ({ g, items: hits.filter((h) => h.type === g) })).filter((x) => x.items.length);

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <D.Content className="fixed inset-x-3 top-[12dvh] z-50 mx-auto max-w-xl overflow-hidden rounded-card border border-line bg-surface shadow-lg outline-none">
          <D.Title className="sr-only">بحث شامل</D.Title>
          <D.Description className="sr-only">ابحث في العملاء والمعاملات والمستندات</D.Description>
          <Command shouldFilter={false} dir="rtl">
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-ink-3" strokeWidth={1.75} />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder="ابحث باسم عميل، رقم معاملة، أو اسم مستند..."
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-ink-3"
              />
            </div>
            <Command.List className="max-h-[50dvh] overflow-y-auto p-1.5">
              {q.trim().length >= 2 && !loading && hits.length === 0 && (
                <div className="px-3 py-8 text-center text-sm text-ink-3">لا توجد نتائج</div>
              )}
              {q.trim().length < 2 && <div className="px-3 py-8 text-center text-sm text-ink-3">اكتب حرفين على الأقل</div>}
              {groups.map(({ g, items }) => (
                <Command.Group key={g} heading={GROUP[g]} className="px-1 py-1 text-xs text-ink-3 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {items.map((h) => {
                    const Icon = ICON[h.type];
                    return (
                      <Command.Item
                        key={h.type + h.id}
                        value={h.type + h.id}
                        onSelect={() => { onOpenChange(false); router.push(h.href); }}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-ink aria-selected:bg-navy-soft"
                      >
                        <Icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
                        <span className="min-w-0 flex-1 truncate">{h.title}</span>
                        {h.sub && <span className="truncate text-xs text-ink-3">{h.sub}</span>}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
            </Command.List>
            <button
              onClick={() => { onOpenChange(false); router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search"); }}
              className="flex w-full items-center gap-2 border-t border-line px-3 py-2.5 text-start text-xs text-ink-2 hover:bg-bg"
            >
              <Search className="size-3.5 text-orange" strokeWidth={1.75} /> بحث ذكي متقدم (كتابة أو صوت){q.trim() ? `: «${q.trim()}»` : ""}
            </button>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
