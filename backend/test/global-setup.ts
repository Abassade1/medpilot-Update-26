import { execSync } from "node:child_process";

/** Fresh schema for every run so tests never depend on prior state. */
export default async function () {
  process.env.NODE_ENV = "test";
  const url = process.env.DATABASE_URL ?? "postgres://medpilot@localhost:5433/medpilot_test";
  // reset.ts drops every table. Refuse to point it at anything that isn't clearly a test database,
  // so a DATABASE_URL exported from a dev shell can never wipe development data.
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!/_test$/.test(dbName)) {
    throw new Error(`Refusing to reset "${dbName}": test databases must be named *_test. Unset DATABASE_URL or point it at a test database.`);
  }
  execSync(`DATABASE_URL=${url} npx tsx scripts/reset.ts`, { stdio: "inherit" });
}
