import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { getPool } = await import("../src/lib/db");
  const { syncPromptToDatabase } = await import("../src/lib/prompt");

  const pool = getPool();
  if (!pool) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  await syncPromptToDatabase();
  console.log("Prompt synced to database");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
