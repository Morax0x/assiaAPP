import "server-only";
import { Pool, types as pgTypes } from "pg";
import type { Engine } from "@/lib/db/compat";

/** Engine for a real PostgreSQL (Railway, or any other). Row-level security is enforced per request. */
type G = typeof globalThis & { __pgPool?: Pool; __pgFks?: Promise<Map<string, string>>; __pgProcs?: Map<string, { proretset: boolean; typname: string } | null> };
const g = globalThis as G;

export function pool() {
  g.__pgPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX || 8),
    ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined,
  });
  return g.__pgPool;
}

function ts(v: string) {
  const s = v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + "Z");
  return isNaN(d.getTime()) ? v : d.toISOString();
}
const parsers: Record<number, (v: string) => unknown> = { 1700: (v) => parseFloat(v), 20: (v) => Number(v), 1082: (v) => v, 1114: ts, 1184: ts };
const types = { getTypeParser: (oid: number, format?: string) => parsers[oid] ?? pgTypes.getTypeParser(oid, format as "text") };

export const pgEngine: Engine = {
  async run(role, userId, sql, params = []) {
    const c = await pool().connect();
    try {
      await c.query("begin");
      if (role === "authenticated" && userId) {
        await c.query("set local role authenticated");
        await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      } else if (role === "service") {
        if (userId) await c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      } else {
        await c.query("set local role anon");
      }
      const r = await c.query({ text: sql, values: params as unknown[], types });
      await c.query("commit");
      return { rows: r.rows };
    } catch (e) {
      try { await c.query("rollback"); } catch { /* connection already gone */ }
      throw e;
    } finally {
      c.release();
    }
  },

  fks() {
    g.__pgFks ??= pool().query(`
      select tc.table_name, kcu.column_name, ccu.table_name as foreign_table
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`).then((r) => {
      const m = new Map<string, string>();
      for (const x of r.rows as { table_name: string; column_name: string; foreign_table: string }[]) {
        const k = `${x.table_name}>${x.foreign_table}`;
        if (!m.has(k) || x.column_name !== "created_by") m.set(k, x.column_name);
      }
      return m;
    });
    return g.__pgFks;
  },

  async procMeta(fn) {
    g.__pgProcs ??= new Map();
    if (g.__pgProcs.has(fn)) return g.__pgProcs.get(fn)!;
    const r = await pool().query(
      `select p.proretset, t.typname from pg_proc p join pg_type t on t.oid = p.prorettype join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname = $1 limit 1`, [fn]);
    const v = (r.rows[0] as { proretset: boolean; typname: string } | undefined) ?? null;
    g.__pgProcs.set(fn, v);
    return v;
  },
};
