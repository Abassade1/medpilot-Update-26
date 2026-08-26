import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL ?? "postgres://medpilot@localhost:5433/medpilot_dev";
  const pool = new Pool({ connectionString: url });
  // extensions must exist before any citext column
  await pool.query("create extension if not exists citext; create extension if not exists pgcrypto;");
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("migrations applied:", url.split("/").pop());
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
