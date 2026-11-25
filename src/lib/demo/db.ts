import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Demo mode: a real Postgres (PGlite, runs inside Node) loaded with the project's own migrations
 * and Arabic sample data. Nothing leaves the machine. Used only when DEMO_MODE=1.
 */
export const DEMO_USERS = {
  owner: "00000000-0000-4000-8000-000000000001",
  admin: "00000000-0000-4000-8000-000000000002",
  staff: "00000000-0000-4000-8000-000000000003",
} as const;

type Db = import("@electric-sql/pglite").PGlite;
type G = typeof globalThis & { __demoDb?: Promise<{ db: Db; fks: Map<string, string> }>; __demoLock?: Promise<unknown> };
const g = globalThis as G;

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text); alter table storage.objects enable row level security;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated;
`;

async function init() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const dataDir = path.join(process.cwd(), ".demo-data");
  const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
  const db = new PGlite(dataDir, { extensions: { pg_trgm } });
  await db.waitReady;

  if (fresh) {
    await db.exec(STUBS);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
      await db.exec(fs.readFileSync(path.join(dir, f), "utf8").replace(/create extension if not exists pgcrypto;/, ""));
    }
    await db.exec(fs.readFileSync(path.join(process.cwd(), "supabase", "demo_seed.sql"), "utf8"));
  }

  const fkRows = await db.query<{ table_name: string; column_name: string; foreign_table: string }>(`
    select tc.table_name, kcu.column_name, ccu.table_name as foreign_table
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`);
  const fks = new Map<string, string>();
  for (const r of fkRows.rows) {
    const k = `${r.table_name}>${r.foreign_table}`;
    if (!fks.has(k) || r.column_name !== "created_by") fks.set(k, r.column_name);
  }
  return { db, fks };
}

export function getDemoDb() {
  if (!g.__demoDb) g.__demoDb = init();
  return g.__demoDb;
}

/** Serialises access (PGlite is single-connection). */
export async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__demoLock ?? Promise.resolve();
  let release!: () => void;
  g.__demoLock = new Promise<void>((r) => (release = r));
  await prev.catch(() => {});
  try { return await fn(); } finally { release(); }
}

function ts(v: string) {
  const s = v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + "Z");
  return isNaN(d.getTime()) ? v : d.toISOString();
}

// Make PGlite return the same shapes as PostgREST (numbers, ISO strings)
export const PARSERS = {
  1700: (v: string) => parseFloat(v),
  20: (v: string) => Number(v),
  1082: (v: string) => v,
  1114: ts,
  1184: ts,
};

export async function runSql(role: "authenticated" | "service", userId: string, sql: string, params: unknown[] = []) {
  const { db } = await getDemoDb();
  return withLock(async () => {
    await db.exec("begin");
    try {
      if (role === "authenticated") await db.exec(`set local role authenticated; select set_config('request.jwt.claim.sub','${userId}',true)`);
      else await db.exec(`select set_config('request.jwt.claim.sub','${userId}',true)`);
      const r = await db.query(sql, params, { parsers: PARSERS });
      await db.exec("commit");
      return r;
    } catch (e) {
      await db.exec("rollback");
      throw e;
    }
  });
}
