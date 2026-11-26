/**
 * Which backend the app talks to. Safe to import anywhere (including middleware): no dependencies.
 *  - demo:     embedded sample database (npm run demo)
 *  - pg:       your own PostgreSQL, e.g. Railway (set DATABASE_URL)
 *  - supabase: Supabase (default)
 */
export const isDemo = () => process.env.DEMO_MODE === "1";
export const isPg = () => !isDemo() && !!process.env.DATABASE_URL;
export const SESSION_COOKIE = "assia_session";
