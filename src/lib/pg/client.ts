/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { makeCompat, type Role } from "@/lib/db/compat";
import { pgEngine } from "@/lib/pg/engine";
import { hashPin, verifyPin } from "@/lib/share";
import { SESSION_COOKIE } from "@/lib/mode";

/**
 * Own sign-in for PostgreSQL mode (no Supabase): password check, sessions stored in the database,
 * and a long-lived httpOnly cookie so each device stays signed in until you sign it out.
 */
const DAYS = 400;
const MAX_TRIES = 8;
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const run = (sql: string, params: unknown[] = []) => pgEngine.run("service", null, sql, params);
const NO_STORAGE = { message: "تخزين الملفات غير مضبوط. أضف متغيرات S3_ في الإعدادات." };

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + DAYS * 86400_000);
  await run("insert into auth.sessions(user_id, token_hash, expires_at) values ($1, $2, $3)", [userId, sha(token), expires.toISOString()]);
  await run("update auth.users set last_sign_in_at = now(), failed_attempts = 0, locked_until = null where id = $1", [userId]);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: DAYS * 86400, path: "/" });
}

const userFromCookie = cache(async (): Promise<{ id: string; email: string } | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length < 32) return null;
  const r = await run(
    "select u.id, u.email from auth.sessions s join auth.users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now() and not u.banned",
    [sha(token)]);
  return (r.rows[0] as { id: string; email: string } | undefined) ?? null;
});

const authApi = {
  getUser: async () => {
    const u = await userFromCookie();
    return { data: { user: u }, error: u ? null : { message: "not signed in" } };
  },
  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    const r = await run("select id, encrypted_password, banned, failed_attempts, locked_until from auth.users where lower(email) = lower($1)", [email.trim()]);
    const u = r.rows[0] as { id: string; encrypted_password: string | null; banned: boolean; failed_attempts: number; locked_until: string | null } | undefined;
    const bad = { data: {}, error: { message: "Invalid login credentials" } };
    if (!u || u.banned || !u.encrypted_password) return bad;
    if (u.locked_until && new Date(u.locked_until) > new Date()) return { data: {}, error: { message: "Too many attempts" } };
    if (!verifyPin(password, u.encrypted_password)) {
      const n = u.failed_attempts + 1;
      await run("update auth.users set failed_attempts = $2, locked_until = $3 where id = $1", [u.id, n, n >= MAX_TRIES ? new Date(Date.now() + 15 * 60_000).toISOString() : null]);
      return bad;
    }
    await createSession(u.id);
    return { data: { user: { id: u.id } }, error: null };
  },
  signOut: async () => {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) await run("delete from auth.sessions where token_hash = $1", [sha(token)]);
    jar.delete(SESSION_COOKIE);
    return { error: null };
  },
  admin: {
    createUser: async ({ email, password, user_metadata }: { email: string; password: string; email_confirm?: boolean; user_metadata?: Record<string, unknown> }) => {
      try {
        const r = await run("insert into auth.users(email, encrypted_password, raw_user_meta_data) values ($1, $2, $3::jsonb) returning id", [email.trim(), hashPin(password), JSON.stringify(user_metadata ?? {})]);
        return { data: { user: { id: (r.rows[0] as { id: string }).id } }, error: null };
      } catch (e: any) {
        return { data: { user: null }, error: { message: e?.code === "23505" ? "User already registered" : String(e?.message ?? e) } };
      }
    },
    updateUserById: async (id: string, patch: { password?: string; ban_duration?: string }) => {
      try {
        if (patch.password) await run("update auth.users set encrypted_password = $2 where id = $1", [id, hashPin(patch.password)]);
        if (patch.ban_duration !== undefined) {
          const banned = patch.ban_duration !== "none";
          await run("update auth.users set banned = $2 where id = $1", [id, banned]);
          if (banned) await run("delete from auth.sessions where user_id = $1", [id]);
        }
        return { data: { user: { id } }, error: null };
      } catch (e: any) {
        return { data: { user: null }, error: { message: String(e?.message ?? e) } };
      }
    },
    deleteUser: async (id: string) => {
      try {
        await run("delete from auth.users where id = $1", [id]);
        return { data: {}, error: null };
      } catch (e: any) {
        return { data: null, error: { message: String(e?.message ?? e) } };
      }
    },
    getUserById: async (id: string) => {
      const r = await run("select id, email, last_sign_in_at from auth.users where id = $1", [id]);
      const u = r.rows[0] as { id: string; email: string; last_sign_in_at: string | null } | undefined;
      return { data: { user: u ?? null }, error: null };
    },
  },
};

const storage = {
  from: () => ({
    createSignedUrl: async () => ({ data: null, error: NO_STORAGE }),
    upload: async () => ({ data: null, error: NO_STORAGE }),
  }),
};

function make(role: Role, userId: string | null) {
  return { ...makeCompat(pgEngine, role, userId), storage, auth: authApi };
}

export async function pgServerClient() {
  const u = await userFromCookie();
  return make(u ? "authenticated" : "anon", u?.id ?? null);
}

export function pgAdminClient() {
  return make("service", null);
}
