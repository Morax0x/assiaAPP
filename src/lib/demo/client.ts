import "server-only";
import { cookies } from "next/headers";
import { DEMO_USERS, getDemoDb, runSql } from "@/lib/demo/db";
import { makeCompat, type Engine, type Role } from "@/lib/db/compat";

/** Demo engine: the embedded PGlite database. */
const engine: Engine = {
  run: (role, userId, sql, params) => runSql(role === "service" ? "service" : "authenticated", userId ?? DEMO_USERS.owner, sql, params),
  fks: async () => (await getDemoDb()).fks,
  procMeta: async (fn) => {
    const { db } = await getDemoDb();
    const r = await db.query<{ proretset: boolean; typname: string }>(
      `select p.proretset, t.typname from pg_proc p join pg_type t on t.oid = p.prorettype join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname = $1 limit 1`, [fn]);
    return r.rows[0] ?? null;
  },
};

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
  return {
    ...makeCompat(engine, role, userId),
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
