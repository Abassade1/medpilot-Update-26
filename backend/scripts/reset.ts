import { execSync } from "node:child_process";
import { Pool } from "pg";

/** Drops and rebuilds the schema, then seeds catalog data. Never production. */
async function main() {
  if (process.env.NODE_ENV === "production") { console.error("Refusing to reset production."); process.exit(1); }
  const url = process.env.DATABASE_URL ?? "postgres://medpilot@localhost:5433/medpilot_dev";
  const pool = new Pool({ connectionString: url });
  await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await pool.end();
  execSync(`DATABASE_URL=${url} npx tsx scripts/migrate.ts`, { stdio: "inherit" });
  execSync(`DATABASE_URL=${url} npx tsx scripts/seed.ts`, { stdio: "inherit" });
}
main().catch((e) => { console.error(e); process.exit(1); });
