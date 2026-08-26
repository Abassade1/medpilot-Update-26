import { execSync } from "node:child_process";

/** Fresh schema for every run so tests never depend on prior state. */
export default async function () {
  process.env.NODE_ENV = "test";
  const url = process.env.DATABASE_URL ?? "postgres://medpilot@localhost:5433/medpilot_test";
  execSync(`DATABASE_URL=${url} npx tsx scripts/reset.ts`, { stdio: "inherit" });
}
