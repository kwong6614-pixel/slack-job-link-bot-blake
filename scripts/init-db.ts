import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { getPool, INIT_SQL } = await import("../src/lib/db");
  const { syncPromptToDatabase } = await import("../src/lib/prompt");

  const pool = getPool();
  if (!pool) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  await pool.query(INIT_SQL);
  console.log("Database initialized");

  await syncPromptToDatabase();
  console.log("Prompt synced from prompts/jd-analysis-prompt.txt to database");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
