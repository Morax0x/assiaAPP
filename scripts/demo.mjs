// Starts the app in DEMO mode: a local database with Arabic sample data. No Supabase account needed.
//   npm run demo          -> http://localhost:3000
//   npm run demo:reset    -> wipes the demo data and starts fresh
import { spawn } from "node:child_process";
import fs from "node:fs";

if (process.argv.includes("--reset")) {
  fs.rmSync(".demo-data", { recursive: true, force: true });
  console.log("Demo data reset.");
}

const env = {
  ...process.env,
  DEMO_MODE: "1",
  NEXT_PUBLIC_DEMO_MODE: "1",
  NEXT_PUBLIC_SUPABASE_URL: "http://demo.local",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "demo",
  SUPABASE_SERVICE_ROLE_KEY: "demo",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

console.log("\n  Demo mode: sample data only. Open http://localhost:3000 when it says Ready.\n");
const child = spawn("npx", ["next", "dev", "--turbopack", "-p", "3000"], { stdio: "inherit", shell: true, env });
child.on("exit", (c) => process.exit(c ?? 0));
