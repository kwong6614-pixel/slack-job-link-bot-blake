import { analyzeJobDescription } from "./openai-analyzer";
import { normalizeCompanyNameForSheet } from "./company-normalize";
import { scrapeJobDescription } from "./scraper";
import {
  appendJobToSheets,
  createSheetContext,
  isDuplicateCompany,
  isDuplicateUrl,
  verifyGoogleSheetsAuth,
  type SheetContext,
} from "./sheets";
import { postMessage, getUserDisplayName } from "./slack";
import { ensurePromptInDatabase } from "./prompt";
import { formatProcessingError } from "./processing-errors";
import { alertOnCredentialFailure } from "./credential-alerts";
import type { ProcessedJob } from "./types";

function formatSummary(job: ProcessedJob): string {
  const reasonLabel =
    job.status === "Failed" ? "Error" : job.status === "Rejected" ? "Reason" : null;

  const lines = [
    `*${job.status}* — ${job.company_name || "Unknown company"}`,
    job.role_title ? `Role: ${job.role_title}` : null,
    job.tech_stack && job.status !== "Failed" ? `Stack: ${job.tech_stack}` : null,
    job.token_usage ? `Tokens: ${job.token_usage}` : null,
    job.rejection_reason && reasonLabel
      ? `${reasonLabel}: ${job.rejection_reason}`
      : null,
    `<${job.url}|View job>`,
  ].filter(Boolean);

  return lines.join("\n");
}

function formatCompletionMessage(jobs: ProcessedJob[]): string {
  const accepted = jobs.filter((j) => j.status === "Accepted").length;
  const rejected = jobs.filter((j) => j.status === "Rejected").length;
  const failed = jobs.filter((j) => j.status === "Failed").length;
  const total = jobs.length;

  const parts = [
    accepted > 0 ? `${accepted} accepted` : null,
    rejected > 0 ? `${rejected} rejected` : null,
    failed > 0 ? `${failed} failed` : null,
  ].filter(Boolean);

  const summary = parts.length > 0 ? parts.join(", ") : "no results";
  return `*Completed* — processed ${total} URL${total === 1 ? "" : "s"}: ${summary}`;
}

function rejectedJob(
  url: string,
  submittedBy: string,
  reason: string,
  token_usage = 0,
  extras?: Partial<ProcessedJob>
): ProcessedJob {
  return {
    url,
    status: "Rejected",
    company_name: extras?.company_name ?? "",
    role_title: extras?.role_title ?? "",
    tech_stack: extras?.tech_stack ?? "Extra",
    responsibilities: extras?.responsibilities ?? "",
    qualifications_required: extras?.qualifications_required ?? "",
    qualifications_preferred: extras?.qualifications_preferred ?? "",
    rejection_reason: reason,
    token_usage,
    submitted_by: submittedBy,
    scrape_note: extras?.scrape_note,
  };
}

function failedJob(
  url: string,
  submittedBy: string,
  reason: string,
  token_usage = 0
): ProcessedJob {
  return {
    url,
    status: "Failed",
    company_name: "",
    role_title: "",
    tech_stack: "Extra",
    responsibilities: "",
    qualifications_required: "",
    qualifications_preferred: "",
    rejection_reason: reason,
    token_usage,
    submitted_by: submittedBy,
    scrape_note: reason,
  };
}

async function processSingleUrl(
  url: string,
  submittedBy: string,
  sheetCtx: SheetContext
): Promise<ProcessedJob> {
  const urlDup = isDuplicateUrl(sheetCtx.index, url);
  if (urlDup.duplicate) {
    return rejectedJob(url, submittedBy, urlDup.reason ?? "Duplicate URL");
  }

  const scrape = await scrapeJobDescription(url);

  if (!scrape.text || scrape.notJobPage) {
    return failedJob(
      url,
      submittedBy,
      scrape.error ?? "Could not find job description content"
    );
  }

  const { result, token_usage } = await analyzeJobDescription(url, scrape.text);
  const companyName = normalizeCompanyNameForSheet(result.company_name);

  // Trust structured scrapes (JSON-LD / ATS APIs) over is_job_page=false.
  if (!result.is_job_page && !scrape.structured) {
    const reason =
      result.rejection_reasons.join("; ") ||
      "Page content is not a job description";
    return failedJob(url, submittedBy, reason, token_usage);
  }

  const companyDup = isDuplicateCompany(sheetCtx.index, companyName);
  if (companyDup.duplicate) {
    return rejectedJob(
      url,
      submittedBy,
      companyDup.reason ?? "Duplicate",
      token_usage,
      {
        company_name: companyName,
        role_title: result.role_title,
        tech_stack: result.tech_stack,
        responsibilities: result.responsibilities,
        qualifications_required: result.qualifications_required,
        qualifications_preferred: result.qualifications_preferred,
        scrape_note: scrape.partial ? "Partial scrape — analyzed available text" : undefined,
      }
    );
  }

  if (result.status === "REJECTED") {
    return rejectedJob(
      url,
      submittedBy,
      result.rejection_reasons.join("; ") || "Rejected by analysis rules",
      token_usage,
      {
        company_name: companyName,
        role_title: result.role_title,
        tech_stack: result.tech_stack,
        responsibilities: result.responsibilities,
        qualifications_required: result.qualifications_required,
        qualifications_preferred: result.qualifications_preferred,
        scrape_note: scrape.partial ? "Partial scrape — analyzed available text" : undefined,
      }
    );
  }

  return {
    url,
    status: "Accepted",
    company_name: companyName,
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
  try {
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

    await verifyGoogleSheetsAuth();
    const sheetCtx = await createSheetContext();
    const results: ProcessedJob[] = [];

    for (const url of urls) {
      try {
        const job = await processSingleUrl(url, submittedBy, sheetCtx);
        await appendJobToSheets(sheetCtx, job);
        results.push(job);
        await postMessage(channel, formatSummary(job));
      } catch (error) {
        await alertOnCredentialFailure(error, { channel, userId, url });
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
        await appendJobToSheets(sheetCtx, failedJob);
        results.push(failedJob);
        await postMessage(channel, `*Failed* — <${url}|${url}>\nError: ${message}`);
      }
    }

    await postMessage(channel, formatCompletionMessage(results));
  } catch (error) {
    await alertOnCredentialFailure(error, { channel, userId });
    const message = formatProcessingError(error);
    console.error("Job batch processing failed:", error);
    await postMessage(channel, `*Failed* — ${message}`);
  }
}
