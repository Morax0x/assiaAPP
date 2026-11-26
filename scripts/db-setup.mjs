// Prepares your own PostgreSQL (e.g. Railway) the first time, and applies new updates on every start.
//   - does nothing when DATABASE_URL is not set (Supabase mode)
//   - creates the login tables + roles, runs supabase/migrations/*.sql once each, and creates the owner account
// Needs: DATABASE_URL. For the first start also: OWNER_EMAIL and OWNER_PASSWORD.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url || process.env.DEMO_MODE === "1") process.exit(0);

const client = new pg.Client({ connectionString: url, ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined });

const BASE = `
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create table if not exists auth.users(
  id uuid primary key default gen_random_uuid(), email text unique not null, encrypted_password text,
  raw_user_meta_data jsonb not null default '{}', banned boolean not null default false,
  failed_attempts int not null default 0, locked_until timestamptz, last_sign_in_at timestamptz, created_at timestamptz not null default now());
create table if not exists auth.sessions(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text unique, created_at timestamptz not null default now(), expires_at timestamptz);
create index if not exists auth_sessions_user_idx on auth.sessions(user_id);
create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create schema if not exists storage;
create table if not exists storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
create table if not exists storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated;
create table if not exists public._migrations(name text primary key, applied_at timestamptz not null default now());
`;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 32).toString("hex")}`;   // same format the app verifies
}

async function connect() {
  for (let i = 1; i <= 10; i++) {
    try { await client.connect(); return; } catch (e) {
      if (i === 10) throw e;
      console.log(`[db-setup] waiting for the database (${i}/10)...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

await connect();
try {
  await client.query(BASE);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await client.query("select name from public._migrations")).rows.map((r) => r.name));
  for (const f of files) {
    if (done.has(f)) continue;
    console.log(`[db-setup] applying ${f}`);
    try {
      await client.query("begin");
      await client.query(fs.readFileSync(path.join(dir, f), "utf8").replace(/create extension if not exists pgcrypto;/g, ""));   // not needed on PostgreSQL 13+
      await client.query("insert into public._migrations(name) values ($1)", [f]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.error(`[db-setup] FAILED on ${f}: ${e.message}`);
      process.exit(1);
    }
  }
  const { rows } = await client.query("select count(*)::int as n from auth.users");
  const email = process.env.OWNER_EMAIL?.trim();
  const password = process.env.OWNER_PASSWORD;
  if (rows[0].n === 0) {
    if (!email || !password || password.length < 8) {
      console.log("[db-setup] No users yet. Set OWNER_EMAIL and OWNER_PASSWORD (8+ characters) and restart to create the owner account.");
    } else {
      await client.query("insert into auth.users(email, encrypted_password, raw_user_meta_data) values ($1, $2, $3::jsonb)",
        [email, hashPassword(password), JSON.stringify({ full_name: process.env.OWNER_NAME || "المالك" })]);
      console.log(`[db-setup] Owner account created for ${email}`);
    }
  }
  console.log("[db-setup] database is ready");
} finally {
  await client.end();
}
