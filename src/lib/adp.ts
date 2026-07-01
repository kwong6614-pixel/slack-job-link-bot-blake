import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";

export interface AdpJobIds {
  cid: string;
  jobId: string;
}

export function isAdpUrl(url: string): boolean {
  try {
    const host = new URL(normalizeIncomingUrl(url)).hostname.toLowerCase();
    return host.includes("workforcenow.adp.com");
  } catch {
    return false;
  }
}

export function parseAdpUrl(url: string): AdpJobIds | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));
    const cid = parsed.searchParams.get("cid");
    const jobId = parsed.searchParams.get("jobId");
    if (!cid || !jobId) return null;
    return { cid, jobId };
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

export async function fetchAdpJob(url: string): Promise<string | null> {
  const ids = parseAdpUrl(url);
  if (!ids) return null;

  const apiUrl = new URL(
    `https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/${ids.jobId}`
  );
  apiUrl.searchParams.set("cid", ids.cid);
  apiUrl.searchParams.set("lang", "en_US");
  apiUrl.searchParams.set("locale", "en_US");

  try {
    const response = await fetch(apiUrl.toString(), {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      requisitionTitle?: string;
      requisitionDescription?: string;
      workLevelCode?: { shortName?: string };
      requisitionLocations?: { nameCode?: { shortName?: string } }[];
    };

    const description = stripHtml(String(data.requisitionDescription || ""));
    if (description.length < 50) return null;

    const locations = (data.requisitionLocations || [])
      .map((loc) => loc.nameCode?.shortName)
      .filter(Boolean)
      .join("; ");

    return [
      data.requisitionTitle ? `Job Title: ${data.requisitionTitle}` : "",
      data.workLevelCode?.shortName
        ? `Employment Type: ${data.workLevelCode.shortName}`
        : "",
      locations ? `Location: ${locations}` : "",
      "",
      description,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}
