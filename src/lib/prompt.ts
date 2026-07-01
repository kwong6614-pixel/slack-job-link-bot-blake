import fs from "fs/promises";
import path from "path";
import { getPool } from "./db";

const PROMPT_FILE = path.join(process.cwd(), "prompts", "jd-analysis-prompt.txt");

export async function readPromptFromFile(): Promise<string> {
  return fs.readFile(PROMPT_FILE, "utf-8");
}

export async function getAnalysisPrompt(): Promise<string> {
  // Edit prompts/jd-analysis-prompt.txt in the repo, then redeploy.
  // Run `npm run sync-prompt` to also persist a copy in Supabase.
  return readPromptFromFile();
}

export async function syncPromptToDatabase(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  const content = await readPromptFromFile();
  await pool.query(
    `INSERT INTO analysis_prompt (content) VALUES ($1)`,
    [content]
  );
}

export async function ensurePromptInDatabase(): Promise<void> {
  const pool = getPool();
  if (!pool) return;

  try {
    const result = await pool.query("SELECT 1 FROM analysis_prompt LIMIT 1");
    if (result.rowCount === 0) {
      const content = await readPromptFromFile();
      await pool.query(`INSERT INTO analysis_prompt (content) VALUES ($1)`, [
        content,
      ]);
    }
  } catch (error) {
    console.error("Failed to seed analysis prompt:", error);
  }
}
