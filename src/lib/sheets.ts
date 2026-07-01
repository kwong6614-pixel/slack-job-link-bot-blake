import { google, sheets_v4 } from "googleapis";
import {
  ACCEPTED_HEADERS,
  FAILED_HEADERS,
  REJECTED_HEADERS,
  ALL_SHEET_TABS,
  SHEET_TABS,
  type ProcessedJob,
  type SheetIndex,
  type SheetTab,
  type TechStack,
} from "./types";

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
  if (tab === SHEET_TABS.REJECTED) return REJECTED_HEADERS;
  return ACCEPTED_HEADERS;
}

async function getExistingTabTitles(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<Set<string>> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titles = meta.data.sheets?.map((s) => s.properties?.title ?? "") ?? [];
  return new Set(titles.filter(Boolean));
}

async function createMissingTabs(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  const existing = await getExistingTabTitles(sheets, spreadsheetId);
  const missing = ALL_SHEET_TABS.filter((tab) => !existing.has(tab));

  if (missing.length === 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: missing.map((title) => ({
        addSheet: { properties: { title } },
      })),
    },
  });
}

async function ensureTabHeaders(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: SheetTab
): Promise<void> {
  const headers = headersForTab(tab);
  const range = `'${tab}'!A1:Z1`;

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const firstRow = existing.data.values?.[0];
  if (!firstRow || firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers as unknown as string[]] },
    });
  }
}

export async function initializeSpreadsheet(): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await createMissingTabs(sheets, spreadsheetId);

  for (const tab of ALL_SHEET_TABS) {
    await ensureTabHeaders(sheets, spreadsheetId, tab);
  }
}

async function getLastRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: SheetTab
): Promise<number> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A:A`,
  });

  const values = response.data.values ?? [];
  return Math.max(values.length, 1);
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

function jobToRejectedRow(job: ProcessedJob): string[] {
  return [
    formatDate(),
    job.company_name,
    job.role_title,
    job.tech_stack,
    job.url,
    job.rejection_reason,
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

async function appendRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: SheetTab,
  row: string[]
): Promise<void> {
  const lastRow = await getLastRow(sheets, spreadsheetId, tab);
  const nextRow = lastRow + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!A${nextRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
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

export async function appendJobToSheets(job: ProcessedJob): Promise<void> {
  await initializeSpreadsheet();

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  if (job.status === "Failed") {
    await appendRow(sheets, spreadsheetId, SHEET_TABS.FAILED, jobToFailedRow(job));
    return;
  }

  if (job.status === "Rejected") {
    await appendRow(
      sheets,
      spreadsheetId,
      SHEET_TABS.REJECTED,
      jobToRejectedRow(job)
    );
    return;
  }

  const acceptedRow = jobToAcceptedRow(job);
  await appendRow(sheets, spreadsheetId, SHEET_TABS.ALL_JOBS, acceptedRow);
  await appendRow(sheets, spreadsheetId, techStackTab(job.tech_stack), acceptedRow);
}

async function readColumnValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tab: SheetTab,
  column: string
): Promise<string[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${tab}'!${column}:${column}`,
    });
    const values = response.data.values ?? [];
    return values.slice(1).flat().filter(Boolean).map(String);
  } catch {
    return [];
  }
}

export async function buildSheetIndex(): Promise<SheetIndex> {
  await initializeSpreadsheet();

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const urlTabs: SheetTab[] = [
    SHEET_TABS.ALL_JOBS,
    SHEET_TABS.FULL_STACK,
    SHEET_TABS.AI,
    SHEET_TABS.QA,
    SHEET_TABS.DEVOPS,
    SHEET_TABS.EXTRA,
    SHEET_TABS.FAILED,
    SHEET_TABS.REJECTED,
  ];

  const companyTabs: SheetTab[] = [
    SHEET_TABS.ALL_JOBS,
    SHEET_TABS.FULL_STACK,
    SHEET_TABS.AI,
    SHEET_TABS.QA,
    SHEET_TABS.DEVOPS,
    SHEET_TABS.EXTRA,
  ];

  const urls = new Set<string>();
  const companies = new Set<string>();

  for (const tab of urlTabs) {
    const urlColumn = tab === SHEET_TABS.FAILED ? "B" : "E";
    const values = await readColumnValues(sheets, spreadsheetId, tab, urlColumn);
    values.forEach((url) => urls.add(normalize(url)));
  }

  for (const tab of companyTabs) {
    const values = await readColumnValues(sheets, spreadsheetId, tab, "B");
    values.forEach((company) => companies.add(normalize(company)));
  }

  return { urls, companies };
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
