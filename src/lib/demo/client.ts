/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { cookies } from "next/headers";
import { DEMO_USERS, getDemoDb, runSql } from "@/lib/demo/db";

/**
 * A small Supabase-compatible client backed by the demo database. It understands the subset of the
 * query builder this app uses (select/insert/update/upsert/delete, filters, embeds, rpc) and runs
 * everything through the real tables, views, functions and row-level-security policies.
 */

type Role = "authenticated" | "service";
const ID = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const q = (s: string) => {
  if (!ID.test(s)) throw new Error(`bad identifier: ${s}`);
  return `"${s}"`;
};

function splitTop(s: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0, cur = "", inQ = false;
  for (const ch of s) {
    if (ch === '"') inQ = !inQ;
    if (!inQ) { if (ch === "(") depth++; if (ch === ")") depth--; }
    if (ch === sep && depth === 0 && !inQ) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

const strip = (v: string) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v);

class Builder implements PromiseLike<any> {
  private kind: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private cols = "*";
  private wantCount = false;
  private head = false;
  private where: string[] = [];
  private params: unknown[] = [];
  private orders: string[] = [];
  private lim: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private payload: any = null;
  private returning = false;
  private conflict: string | null = null;

  constructor(private table: string, private role: Role, private userId: string, private fks: () => Promise<Map<string, string>>) {}

  /* ---- verbs ---- */
  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    if (this.kind === "select") this.cols = cols; else { this.returning = true; this.cols = cols; }
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(v: any) { this.kind = "insert"; this.payload = v; return this; }
  update(v: any) { this.kind = "update"; this.payload = v; return this; }
  upsert(v: any, o?: { onConflict?: string }) { this.kind = "upsert"; this.payload = v; this.conflict = o?.onConflict ?? null; return this; }
  delete() { this.kind = "delete"; return this; }

  /* ---- filters ---- */
  private p(v: unknown) { this.params.push(v); return `$${this.params.length}`; }
  private col(c: string) {
    const m = c.match(/^([a-zA-Z_][a-zA-Z0-9_]*)->>([a-zA-Z_][a-zA-Z0-9_]*)$/);
    return m ? `(t.${q(m[1])}->>'${m[2]}')` : `t.${q(c)}`;
  }
  private cond(c: string, op: string, v: any): string {
    const col = this.col(c);
    switch (op) {
      case "eq": return v === null ? `${col} is null` : `${col} = ${this.p(v)}`;
      case "neq": return v === null ? `${col} is not null` : `${col} <> ${this.p(v)}`;
      case "gt": return `${col} > ${this.p(v)}`;
      case "gte": return `${col} >= ${this.p(v)}`;
      case "lt": return `${col} < ${this.p(v)}`;
      case "lte": return `${col} <= ${this.p(v)}`;
      case "like": return `${col} like ${this.p(v)}`;
      case "ilike": return `${col} ilike ${this.p(v)}`;
      case "in": return `${col} = any(${this.p(v)})`;
      case "is": return v === null || v === "null" ? `${col} is null` : `${col} is ${v === true || v === "true" ? "true" : "false"}`;
      default: throw new Error(`unsupported operator ${op}`);
    }
  }
  eq(c: string, v: any) { this.where.push(this.cond(c, "eq", v)); return this; }
  neq(c: string, v: any) { this.where.push(this.cond(c, "neq", v)); return this; }
  gt(c: string, v: any) { this.where.push(this.cond(c, "gt", v)); return this; }
  gte(c: string, v: any) { this.where.push(this.cond(c, "gte", v)); return this; }
  lt(c: string, v: any) { this.where.push(this.cond(c, "lt", v)); return this; }
  lte(c: string, v: any) { this.where.push(this.cond(c, "lte", v)); return this; }
  like(c: string, v: any) { this.where.push(this.cond(c, "like", v)); return this; }
  ilike(c: string, v: any) { this.where.push(this.cond(c, "ilike", v)); return this; }
  in(c: string, v: any[]) { this.where.push(this.cond(c, "in", v)); return this; }
  is(c: string, v: any) { this.where.push(this.cond(c, "is", v)); return this; }
  not(c: string, op: string, v: any) {
    const inner = op === "is" && (v === null || v === "null") ? `${this.col(c)} is null` : this.cond(c, op, v);
    this.where.push(`not (${inner})`);
    return this;
  }
  or(expr: string) {
    const parts = splitTop(expr).map((part) => {
      const m = part.match(/^([a-zA-Z_][a-zA-Z0-9_>\-]*)\.(eq|neq|gt|gte|lt|lte|ilike|like|in|is)\.([\s\S]*)$/);
      if (!m) throw new Error(`unsupported or() condition: ${part}`);
      const [, c, op, raw] = m;
      let v: any = raw;
      if (op === "in") v = splitTop(raw.replace(/^\(|\)$/g, "")).map(strip);
      else v = strip(raw);
      return this.cond(c, op, v);
    });
    this.where.push(`(${parts.join(" or ")})`);
    return this;
  }
  order(c: string, o?: { ascending?: boolean }) { this.orders.push(`${this.col(c)} ${o?.ascending === false ? "desc" : "asc"}`); return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  /* ---- select list with many-to-one embeds ---- */
  private async selectList(table: string, alias: string, cols: string, fks: Map<string, string>, depth = 0): Promise<string> {
    const items = splitTop(cols);
    const out: string[] = [];
    for (const it of items) {
      if (it === "*") { out.push(`${alias}.*`); continue; }
      const m = it.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:!inner)?\(([\s\S]*)\)$/);
      if (m) {
        const rel = m[1];
        const fk = fks.get(`${table}>${rel}`);
        if (!fk) throw new Error(`no relationship ${table} -> ${rel}`);
        const a = `r${depth}`;
        out.push(`(select to_jsonb(${a}) from (select ${await this.selectList(rel, `x${depth}`, m[2], fks, depth + 1)} from ${q(rel)} x${depth} where x${depth}."id" = ${alias}.${q(fk)}) ${a}) as ${q(rel)}`);
      } else out.push(`${alias}.${q(it)}`);
    }
    return out.join(", ");
  }
  private plainList(cols: string) {
    return splitTop(cols).filter((c) => !c.includes("(")).map((c) => (c === "*" ? "*" : q(c))).join(", ") || "*";
  }

  private whereSql() { return this.where.length ? ` where ${this.where.join(" and ")}` : ""; }

  /* ---- execution ---- */
  private async exec(): Promise<{ data: any; error: any; count?: number | null }> {
    try {
      const fks = await this.fks();
      let rows: any[] = [];
      let count: number | null = null;

      if (this.kind === "select") {
        if (this.wantCount) {
          const c = await runSql(this.role, this.userId, `select count(*)::int as c from ${q(this.table)} t${this.whereSql()}`, this.params);
          count = (c.rows[0] as any).c;
          if (this.head) return { data: null, error: null, count };
        }
        const list = await this.selectList(this.table, "t", this.cols, fks);
        let sql = `select ${list} from ${q(this.table)} t${this.whereSql()}`;
        if (this.orders.length) sql += ` order by ${this.orders.join(", ")}`;
        const lim = this.mode === "single" || this.mode === "maybe" ? 2 : this.lim;
        if (lim !== null) sql += ` limit ${Number(lim)}`;
        rows = (await runSql(this.role, this.userId, sql, this.params)).rows as any[];
      } else {
        const ret = this.returning ? ` returning ${this.plainList(this.cols)}` : "";
        if (this.kind === "insert" || this.kind === "upsert") {
          const list: any[] = Array.isArray(this.payload) ? this.payload : [this.payload];
          if (!list.length) return { data: [], error: null };
          const keys = [...new Set(list.flatMap((o) => Object.keys(o)))];
          const vals = list.map((o) => `(${keys.map((k) => this.p(prep(o[k]))).join(", ")})`).join(", ");
          let sql = `insert into ${q(this.table)} (${keys.map(q).join(", ")}) values ${vals}`;
          if (this.kind === "upsert") {
            const target = (this.conflict ?? "id").split(",").map((s) => q(s.trim())).join(", ");
            const upd = keys.filter((k) => !(this.conflict ?? "id").split(",").map((s) => s.trim()).includes(k));
            sql += upd.length ? ` on conflict (${target}) do update set ${upd.map((k) => `${q(k)} = excluded.${q(k)}`).join(", ")}` : ` on conflict (${target}) do nothing`;
          }
          rows = (await runSql(this.role, this.userId, sql + ret, this.params)).rows as any[];
        } else if (this.kind === "update") {
          const keys = Object.keys(this.payload);
          const set = keys.map((k) => `${q(k)} = ${this.p(prep(this.payload[k]))}`).join(", ");
          rows = (await runSql(this.role, this.userId, `update ${q(this.table)} t set ${set}${this.whereSql()}${ret}`, this.params)).rows as any[];
        } else {
          rows = (await runSql(this.role, this.userId, `delete from ${q(this.table)} t${this.whereSql()}${ret}`, this.params)).rows as any[];
        }
        if (!this.returning) return { data: null, error: null };
      }

      if (this.mode === "many") return { data: rows, error: null, count };
      if (this.mode === "single") {
        if (rows.length !== 1) return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
        return { data: rows[0], error: null, count };
      }
      if (rows.length > 1) return { data: null, error: { message: "multiple rows returned" } };
      return { data: rows[0] ?? null, error: null, count };
    } catch (e: any) {
      return { data: null, error: { message: String(e?.message ?? e), code: e?.code } };
    }
  }

  then<R1 = any, R2 = never>(res?: ((v: any) => R1 | PromiseLike<R1>) | null, rej?: ((r: any) => R2 | PromiseLike<R2>) | null) {
    return this.exec().then(res, rej);
  }
}

function prep(v: any) {
  if (v === undefined) return null;
  if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

async function rpc(role: Role, userId: string, fn: string, args: Record<string, any> = {}) {
  try {
    if (!ID.test(fn)) throw new Error("bad function");
    const { db } = await getDemoDb();
    const meta = await db.query<{ proretset: boolean; typname: string }>(
      `select p.proretset, t.typname from pg_proc p join pg_type t on t.oid = p.prorettype join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname = $1 limit 1`, [fn]);
    if (!meta.rows.length) throw new Error(`function ${fn} not found`);
    const keys = Object.keys(args);
    const call = `${q(fn)}(${keys.map((k, i) => `${q(k)} => $${i + 1}`).join(", ")})`;
    const params = keys.map((k) => prep(args[k]));
    const { proretset, typname } = meta.rows[0];
    if (proretset || typname === "record") {
      const r = await runSql(role, userId, `select * from ${call}`, params);
      return { data: r.rows, error: null };
    }
    const r = await runSql(role, userId, `select ${call} as v`, params);
    const v = (r.rows[0] as any)?.v;
    return { data: typname === "void" ? null : v ?? null, error: null };
  } catch (e: any) {
    return { data: null, error: { message: String(e?.message ?? e) } };
  }
}

const DEMO_MSG = "هذا وضع تجريبي: غير متاح هنا";
const demoSvg = (title: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800"><rect width="640" height="800" fill="#f8fafc"/><rect x="32" y="32" width="576" height="736" rx="12" fill="#fff" stroke="#cbd5e1"/><rect x="64" y="72" width="140" height="28" rx="6" fill="#204f89"/><rect x="64" y="120" width="320" height="14" rx="4" fill="#e2e8f0"/><rect x="64" y="148" width="260" height="14" rx="4" fill="#e2e8f0"/><rect x="64" y="220" width="512" height="1" fill="#cbd5e1"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="64" y="${250 + i * 34}" width="${512 - (i % 3) * 90}" height="12" rx="4" fill="#eef1f5"/>`).join("")}<text x="320" y="640" font-family="sans-serif" font-size="30" text-anchor="middle" fill="#f15a27">DEMO FILE</text><text x="320" y="690" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#64748b">${title.replace(/[<&>]/g, "")}</text></svg>`,
  );

function storage() {
  return {
    from: () => ({
      createSignedUrl: async (p: string) => ({ data: { signedUrl: demoSvg(p.split("/").pop() ?? "") }, error: null }),
      upload: async () => ({ data: null, error: { message: "هذا وضع تجريبي: رفع الملفات غير متاح" } }),
    }),
  };
}

function make(role: Role, userId: string) {
  const fks = async () => (await getDemoDb()).fks;
  return {
    from: (t: string) => new Builder(t, role, userId, fks),
    rpc: (fn: string, args?: Record<string, any>) => rpc(role, userId, fn, args),
    storage: storage(),
    auth: {
      getUser: async () => ({ data: { user: { id: userId, email: "demo@demo.local" } }, error: null }),
      signInWithPassword: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
      admin: {
        createUser: async () => ({ data: { user: null }, error: { message: DEMO_MSG } }),
        updateUserById: async () => ({ data: { user: null }, error: { message: DEMO_MSG } }),
      },
    },
  };
}

export type DemoRole = keyof typeof DEMO_USERS;

export async function demoServerClient() {
  const jar = await cookies();
  const r = jar.get("demo_role")?.value as DemoRole | undefined;
  const id = DEMO_USERS[r && r in DEMO_USERS ? r : "owner"];
  return make("authenticated", id);
}

export function demoAdminClient() {
  return make("service", DEMO_USERS.owner);
}
