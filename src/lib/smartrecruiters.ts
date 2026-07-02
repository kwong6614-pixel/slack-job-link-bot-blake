import * as cheerio from "cheerio";
import { FETCH_HEADERS, fetchHtml } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";
import { extractJobPostingFromHtml } from "./html-extract";

export interface SmartRecruitersJobIds {
  company: string;
  postingId: string;
}

interface JobAdSection {
  title?: string;
  text?: string;
}

interface SmartRecruitersPosting {
  id?: string;
  uuid?: string;
  name?: string;
  company?: { name?: string; identifier?: string };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  department?: { label?: string };
  typeOfEmployment?: { label?: string };
  jobAd?: {
    sections?: Record<string, JobAdSection>;
  };
}

export function isSmartRecruitersUrl(url: string): boolean {
  try {
    const host = new URL(normalizeIncomingUrl(url)).hostname.toLowerCase();
    return host.includes("smartrecruiters.com");
  } catch {
    return false;
  }
}

function normalizePostingId(segment: string): string {
  const uuidMatch = segment.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
  );
  if (uuidMatch) return uuidMatch[1];

  const numericMatch = segment.match(/^(\d+)/);
  return numericMatch?.[1] ?? segment;
}

export function parseSmartRecruitersUrl(url: string): SmartRecruitersJobIds | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));
    const path = parsed.pathname;

    const oneClickMatch = path.match(
      /\/oneclick-ui\/company\/([^/]+)\/publication\/([^/?]+)/i
    );
    if (oneClickMatch) {
      return {
        company: oneClickMatch[1],
        postingId: normalizePostingId(oneClickMatch[2]),
      };
    }

    const publicationMatch = path.match(
      /\/company\/([^/]+)\/publication\/([^/?]+)/i
    );
    if (publicationMatch) {
      return {
        company: publicationMatch[1],
        postingId: normalizePostingId(publicationMatch[2]),
      };
    }

    const jobsMatch = path.match(/^\/([^/]+)\/([^/?]+)\/?$/);
    if (
      jobsMatch &&
      parsed.hostname.toLowerCase().includes("jobs.smartrecruiters.com")
    ) {
      const company = jobsMatch[1];
      if (company === "oneclick-ui") return null;
      return {
        company,
        postingId: normalizePostingId(jobsMatch[2]),
      };
    }

    const legacyMatch = path.match(/^\/([^/]+)\/([^/?]+)\/?$/);
    if (legacyMatch && parsed.hostname.toLowerCase().includes("smartrecruiters.com")) {
      return {
        company: legacyMatch[1],
        postingId: normalizePostingId(legacyMatch[2]),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function stripHtml(html: string): string {
  if (!html.includes("<")) return html.replace(/\s+/g, " ").trim();
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

function formatLocation(location: SmartRecruitersPosting["location"]): string {
  if (!location) return "";
  const parts = [location.city, location.region, location.country].filter(Boolean);
  const base = parts.join(", ");
  if (location.remote) {
    return base ? `${base} (Remote)` : "Remote";
  }
  return base;
}

function formatPosting(data: SmartRecruitersPosting): string | null {
  const sections = data.jobAd?.sections ?? {};
  const sectionText = Object.values(sections)
    .map((section) => {
      const text = stripHtml(String(section?.text || ""));
      if (text.length < 20) return "";
      const title = section?.title?.trim();
      return title ? `${title}:\n${text}` : text;
    })
    .filter(Boolean)
    .join("\n\n");

  if (sectionText.length < 50) return null;

  return [
    data.name ? `Job Title: ${data.name}` : "",
    data.company?.name ? `Company: ${data.company.name}` : "",
    formatLocation(data.location)
      ? `Location: ${formatLocation(data.location)}`
      : "",
    data.department?.label ? `Department: ${data.department.label}` : "",
    data.typeOfEmployment?.label
      ? `Employment Type: ${data.typeOfEmployment.label}`
      : "",
    "",
    sectionText,
  ]
    .filter(Boolean)
    .join("\n");
}

async function fetchSmartRecruitersViaApi(
  company: string,
  postingId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings/${encodeURIComponent(postingId)}`,
      {
        headers: {
          ...FETCH_HEADERS,
          Accept: "application/json",
          Origin: "https://jobs.smartrecruiters.com",
          Referer: "https://jobs.smartrecruiters.com/",
        },
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return null;

    const data = (await response.json()) as SmartRecruitersPosting;
    return formatPosting(data);
  } catch {
    return null;
  }
}

async function resolvePostingIdViaList(
  company: string,
  postingId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=100`,
      {
        headers: {
          ...FETCH_HEADERS,
          Accept: "application/json",
          Origin: "https://jobs.smartrecruiters.com",
          Referer: "https://jobs.smartrecruiters.com/",
        },
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content?: { id?: string; uuid?: string }[];
    };

    const needle = postingId.toLowerCase();
    const match = data.content?.find(
      (posting) =>
        posting.id?.toLowerCase() === needle ||
        posting.uuid?.toLowerCase() === needle
    );

    return match?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchSmartRecruitersViaHtml(
  company: string,
  postingId: string
): Promise<string | null> {
  const canonicalUrl = `https://jobs.smartrecruiters.com/${company}/${postingId}`;
  const html = await fetchHtml(canonicalUrl);
  if (!html) return null;

  const structured = extractJobPostingFromHtml(html);
  if (structured) return structured.text;

  const $ = cheerio.load(html);
  const selectors = [
    "[class*='job-description']",
    "[data-test='job-description']",
    "section[itemprop='description']",
    "main",
  ];

  for (const selector of selectors) {
    const text = $(selector).text().replace(/\s+/g, " ").trim();
    if (text.length > 200) return text;
  }

  return null;
}

export async function fetchSmartRecruitersJob(url: string): Promise<string | null> {
  const ids = parseSmartRecruitersUrl(url);
  if (!ids) return null;

  let apiText = await fetchSmartRecruitersViaApi(ids.company, ids.postingId);
  if (!apiText) {
    const numericId = await resolvePostingIdViaList(ids.company, ids.postingId);
    if (numericId && numericId !== ids.postingId) {
      apiText = await fetchSmartRecruitersViaApi(ids.company, numericId);
    }
  }
  if (apiText) return apiText;

  return fetchSmartRecruitersViaHtml(ids.company, ids.postingId);
}
