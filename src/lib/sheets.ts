import { google, sheets_v4 } from "googleapis";
import {
  ACCEPTED_HEADERS,
  FAILED_HEADERS,
  ALL_SHEET_TABS,
  SHEET_TABS,
  type ProcessedJob,
  type SheetIndex,
  type SheetTab,
  type TechStack,
} from "./types";
import { withSheetsRetry } from "./sheets-retry";

function getAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return oauth2Client;
}

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_ID is not configured");
  return id;
}

function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: getAuthClient() });
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function headersForTab(tab: SheetTab): readonly string[] {
  if (tab === SHEET_TABS.FAILED) return FAILED_HEADERS;
  return ACCEPTED_HEADERS;
}

function formatDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function jobToAcceptedRow(job: ProcessedJob): string[] {
  return [
    formatDate(),
    job.company_name,
    job.role_title,
    job.tech_stack,
    job.url,
    job.responsibilities,
    job.qualifications_required,
    job.qualifications_preferred,
    String(job.token_usage),
    job.submitted_by,
  ];
}

function jobToFailedRow(job: ProcessedJob): string[] {
  return [
    formatDate(),
    job.url,
    job.rejection_reason || job.scrape_note || "Unknown error",
    job.submitted_by,
  ];
}

function techStackTab(stack: TechStack): SheetTab {
  switch (stack) {
    case "Full Stack":
      return SHEET_TABS.FULL_STACK;
    case "AI":
      return SHEET_TABS.AI;
    case "QA":
      return SHEET_TABS.QA;
    case "DevOps":
      return SHEET_TABS.DEVOPS;
    default:
      return SHEET_TABS.EXTRA;
  }
}

export interface SheetContext {
  sheets: sheets_v4.Sheets;
  spreadsheetId: string;
  index: SheetIndex;
}

let initPromise: Promise<void> | null = null;

async function ensureSpreadsheetReady(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = withSheetsRetry(async () => {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    });
    const existing = new Set(
      meta.data.sheets?.map((s) => s.properties?.title ?? "").filter(Boolean) ?? []
    );

    const missing = ALL_SHEET_TABS.filter((tab) => !existing.has(tab));
    if (missing.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: missing.map((title) => ({
            addSheet: { properties: { title } },
          })),
        },
      });
    }

    const headerRanges = ALL_SHEET_TABS.map((tab) => `'${tab}'!A1:J1`);
    const headerResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: headerRanges,
    });

    const updates: { range: string; values: string[][] }[] = [];
    ALL_SHEET_TABS.forEach((tab, i) => {
      const firstRow = headerResponse.data.valueRanges?.[i]?.values?.[0];
      if (!firstRow || firstRow.length === 0) {
        updates.push({
          range: `'${tab}'!A1`,
          values: [headersForTab(tab) as unknown as string[]],
        });
      }
    });

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updates,
        },
      });
    }
  });

  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

async function fetchSheetIndex(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<SheetIndex> {
  return withSheetsRetry(async () => {
    const ranges = [
      `'${SHEET_TABS.ALL_JOBS}'!B:B`,
      `'${SHEET_TABS.ALL_JOBS}'!E:E`,
      `'${SHEET_TABS.FAILED}'!B:B`,
    ];

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
    });

    const urls = new Set<string>();
    const companies = new Set<string>();

    const valueRanges = response.data.valueRanges ?? [];

    const allJobsCompanies = valueRanges[0]?.values?.slice(1).flat() ?? [];
    const allJobsUrls = valueRanges[1]?.values?.slice(1).flat() ?? [];
    const failedUrls = valueRanges[2]?.values?.slice(1).flat() ?? [];

    for (const value of [...allJobsUrls, ...failedUrls]) {
      if (value) urls.add(normalize(String(value)));
    }

    for (const value of allJobsCompanies) {
      if (value) companies.add(normalize(String(value)));
    }

    return { urls, companies };
  });
}

export async function createSheetContext(): Promise<SheetContext> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await ensureSpreadsheetReady(sheets, spreadsheetId);
  const index = await fetchSheetIndex(sheets, spreadsheetId);

  return { sheets, spreadsheetId, index };
}

export function addJobToIndex(index: SheetIndex, job: ProcessedJob): void {
  if (job.url) {
    index.urls.add(normalize(job.url));
  }
  if (job.status === "Accepted" && job.company_name) {
    index.companies.add(normalize(job.company_name));
  }
}

async function appendRow(
  ctx: SheetContext,
  tab: SheetTab,
  row: string[]
): Promise<void> {
  await withSheetsRetry(() =>
    ctx.sheets.spreadsheets.values.append({
      spreadsheetId: ctx.spreadsheetId,
      range: `'${tab}'!A:J`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    })
  );
}

export async function appendJobToSheets(
  ctx: SheetContext,
  job: ProcessedJob
): Promise<void> {
  if (job.status === "Rejected") {
    return;
  }

  if (job.status === "Failed") {
    await appendRow(ctx, SHEET_TABS.FAILED, jobToFailedRow(job));
    addJobToIndex(ctx.index, job);
    return;
  }

  const acceptedRow = jobToAcceptedRow(job);
  await appendRow(ctx, SHEET_TABS.ALL_JOBS, acceptedRow);
  await appendRow(ctx, techStackTab(job.tech_stack), acceptedRow);
  addJobToIndex(ctx.index, job);
}

export function isDuplicate(
  index: SheetIndex,
  url: string,
  companyName: string
): { duplicate: boolean; reason?: string } {
  if (index.urls.has(normalize(url))) {
    return { duplicate: true, reason: "Duplicate URL" };
  }

  if (companyName && index.companies.has(normalize(companyName))) {
    return { duplicate: true, reason: "Duplicate company (one role per company)" };
  }

  return { duplicate: false };
}
