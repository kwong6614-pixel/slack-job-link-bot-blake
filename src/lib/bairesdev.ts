import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";

export function isBairesdevUrl(url: string): boolean {
  try {
    const host = new URL(normalizeIncomingUrl(url)).hostname.toLowerCase();
    return host.includes("bairesdev.com");
  } catch {
    return false;
  }
}

export function parseBairesdevJobId(url: string): string | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));
    const match = parsed.pathname.match(/\/job\/\d+\/(\d+)\/apply/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  if (!html.includes("<")) return html.replace(/\s+/g, " ").trim();
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

export async function fetchBairesdevJob(url: string): Promise<string | null> {
  const jobId = parseBairesdevJobId(url);
  if (!jobId) return null;

  try {
    const response = await fetch(
      `https://applicants.bairesdev.com/api/JobPosting?JobPostingId=${jobId}`,
      {
        headers: { ...FETCH_HEADERS, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      title?: string;
      description?: string;
      employmentType?: string;
      jobLocationType?: string;
      hiringOrganization?: { name?: string };
      applicantLocationRequirements?: { name?: string };
    };

    const description = stripHtml(String(data.description || ""));
    if (description.length < 50) return null;

    const locations = data.applicantLocationRequirements?.name;

    return [
      data.title ? `Job Title: ${data.title}` : "",
      data.hiringOrganization?.name
        ? `Company: ${data.hiringOrganization.name}`
        : "",
      data.employmentType ? `Employment Type: ${data.employmentType}` : "",
      data.jobLocationType ? `Work Type: ${data.jobLocationType}` : "",
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
