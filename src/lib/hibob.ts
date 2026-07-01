import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";

export interface HibobJobIds {
  origin: string;
  jobId: string;
}

export function isHibobUrl(url: string): boolean {
  try {
    const host = new URL(normalizeIncomingUrl(url)).hostname.toLowerCase();
    return host.endsWith(".careers.hibob.com");
  } catch {
    return false;
  }
}

export function parseHibobUrl(url: string): HibobJobIds | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));
    const match = parsed.pathname.match(
      /\/jobs\/([0-9a-f-]{36})\/?$/i
    );
    if (!match) return null;
    return { origin: parsed.origin, jobId: match[1] };
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  if (!html.includes("<")) return html.replace(/\s+/g, " ").trim();
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

function readField(
  record: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = record[key];
    if (value != null && value !== "") return String(value);
  }
  return "";
}

function formatJobAd(data: Record<string, unknown>): string | null {
  const title = readField(
    data,
    "title",
    "name",
    "/jobAd/title",
    "jobAd/title"
  );
  const description = stripHtml(
    readField(
      data,
      "description",
      "jobDescription",
      "content",
      "/jobAd/description",
      "jobAd/description"
    )
  );
  const requirements = stripHtml(
    readField(data, "requirements", "/jobAd/requirements", "jobAd/requirements")
  );
  const responsibilities = stripHtml(
    readField(
      data,
      "responsibilities",
      "/jobAd/responsibilities",
      "jobAd/responsibilities"
    )
  );

  const body = [description, responsibilities, requirements]
    .filter((part) => part.length >= 30)
    .join("\n\n");

  if (body.length < 50) return null;

  const department = readField(
    data,
    "department",
    "/jobAd/department",
    "jobAd/department"
  );
  const employmentType = readField(
    data,
    "employmentType",
    "/jobAd/employmentType",
    "jobAd/employmentType"
  );
  const site = readField(
    data,
    "site",
    "country",
    "/jobAd/site",
    "/jobAd/country",
    "jobAd/site",
    "jobAd/country"
  );

  return [
    title ? `Job Title: ${title}` : "",
    department ? `Department: ${department}` : "",
    employmentType ? `Employment Type: ${employmentType}` : "",
    site ? `Location: ${site}` : "",
    "",
    body,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractFromResponse(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;

  const direct = formatJobAd(record);
  if (direct) return direct;

  const jobAd = record.jobAd;
  if (jobAd && typeof jobAd === "object") {
    const formatted = formatJobAd(jobAd as Record<string, unknown>);
    if (formatted) return formatted;
  }

  if (Array.isArray(record.jobAds) && record.jobAds[0]) {
    return formatJobAd(record.jobAds[0] as Record<string, unknown>);
  }

  return null;
}

export async function fetchHibobJob(url: string): Promise<string | null> {
  const ids = parseHibobUrl(url);
  if (!ids) return null;

  const referer = `${ids.origin}/jobs/${ids.jobId}`;
  const endpoints = [
    `${ids.origin}/api/careers-site/public/job-ads/${ids.jobId}/details`,
    `${ids.origin}/api/careers-site/public/job-ads/${ids.jobId}`,
  ];

  for (const endpoint of endpoints) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            ...FETCH_HEADERS,
            Accept: "application/json",
            Referer: referer,
          },
          signal: AbortSignal.timeout(20_000),
        });

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("retry-after") || "30");
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(retryAfter, 60) * 1000)
          );
          continue;
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.includes("json")) break;

        const data = await response.json();
        const text = extractFromResponse(data);
        if (text) return text;
        break;
      } catch {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
      }
    }
  }

  return null;
}
