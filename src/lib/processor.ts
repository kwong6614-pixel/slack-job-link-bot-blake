import { analyzeJobDescription } from "./openai-analyzer";
import { scrapeJobDescription } from "./scraper";
import {
  appendJobToSheets,
  buildSheetIndex,
  isDuplicate,
} from "./sheets";
import { postMessage, getUserDisplayName } from "./slack";
import { ensurePromptInDatabase } from "./prompt";
import type { ProcessedJob } from "./types";

function formatSummary(job: ProcessedJob): string {
  const lines = [
    `*${job.status}* — ${job.company_name || "Unknown company"}`,
    job.role_title ? `Role: ${job.role_title}` : null,
    job.tech_stack ? `Stack: ${job.tech_stack}` : null,
    job.token_usage ? `Tokens: ${job.token_usage}` : null,
    job.rejection_reason ? `Reason: ${job.rejection_reason}` : null,
    `<${job.url}|View job>`,
  ].filter(Boolean);

  return lines.join("\n");
}

async function processSingleUrl(
  url: string,
  channel: string,
  userId: string,
  submittedBy: string
): Promise<ProcessedJob> {
  const scrape = await scrapeJobDescription(url);

  if (!scrape.text) {
    return {
      url,
      status: "Failed",
      company_name: "",
      role_title: "",
      tech_stack: "Extra",
      responsibilities: "",
      qualifications_required: "",
      qualifications_preferred: "",
      rejection_reason: scrape.error ?? "Scraping failed",
      token_usage: 0,
      submitted_by: submittedBy,
      scrape_note: scrape.error,
    };
  }

  const { result, token_usage } = await analyzeJobDescription(url, scrape.text);
  const sheetIndex = await buildSheetIndex();

  const dup = isDuplicate(sheetIndex, url, result.company_name);
  if (dup.duplicate) {
    return {
      url,
      status: "Rejected",
      company_name: result.company_name,
      role_title: result.role_title,
      tech_stack: result.tech_stack,
      responsibilities: result.responsibilities,
      qualifications_required: result.qualifications_required,
      qualifications_preferred: result.qualifications_preferred,
      rejection_reason: dup.reason ?? "Duplicate",
      token_usage,
      submitted_by: submittedBy,
      scrape_note: scrape.partial ? "Partial scrape — analyzed available text" : undefined,
    };
  }

  if (result.status === "REJECTED") {
    return {
      url,
      status: "Rejected",
      company_name: result.company_name,
      role_title: result.role_title,
      tech_stack: result.tech_stack,
      responsibilities: result.responsibilities,
      qualifications_required: result.qualifications_required,
      qualifications_preferred: result.qualifications_preferred,
      rejection_reason: result.rejection_reasons.join("; ") || "Rejected by analysis rules",
      token_usage,
      submitted_by: submittedBy,
      scrape_note: scrape.partial ? "Partial scrape — analyzed available text" : undefined,
    };
  }

  return {
    url,
    status: "Accepted",
    company_name: result.company_name,
    role_title: result.role_title,
    tech_stack: result.tech_stack,
    responsibilities: result.responsibilities,
    qualifications_required: result.qualifications_required,
    qualifications_preferred: result.qualifications_preferred,
    rejection_reason: "",
    token_usage,
    submitted_by: submittedBy,
    scrape_note: scrape.partial ? "Partial scrape — analyzed available text" : undefined,
  };
}

export async function processUrlsFromMessage(
  urls: string[],
  channel: string,
  userId: string
): Promise<void> {
  await ensurePromptInDatabase();

  const submittedBy = await getUserDisplayName(userId);

  if (urls.length === 0) {
    await postMessage(
      channel,
      "Send me one or more job URLs (Greenhouse, Lever, Ashby, etc.) and I'll analyze them."
    );
    return;
  }

  await postMessage(
    channel,
    `Analyzing ${urls.length} URL${urls.length > 1 ? "s" : ""}…`
  );

  for (const url of urls) {
    try {
      const job = await processSingleUrl(url, channel, userId, submittedBy);
      await appendJobToSheets(job);
      await postMessage(channel, formatSummary(job));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const failedJob: ProcessedJob = {
        url,
        status: "Failed",
        company_name: "",
        role_title: "",
        tech_stack: "Extra",
        responsibilities: "",
        qualifications_required: "",
        qualifications_preferred: "",
        rejection_reason: message,
        token_usage: 0,
        submitted_by: submittedBy,
      };
      await appendJobToSheets(failedJob);
      await postMessage(channel, `*Failed* — <${url}|${url}>\nError: ${message}`);
    }
  }
}
