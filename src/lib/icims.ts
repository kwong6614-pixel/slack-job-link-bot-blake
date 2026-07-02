import * as cheerio from "cheerio";
import { FETCH_HEADERS, fetchHtml } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";
import { extractJobPostingFromHtml } from "./html-extract";

export function isIcimsUrl(url: string): boolean {
  try {
    const host = new URL(normalizeIncomingUrl(url)).hostname.toLowerCase();
    return host.includes("icims.com");
  } catch {
    return false;
  }
}

const STRIP_QUERY_PARAMS = new Set([
  "jr_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "mobile",
  "width",
  "height",
  "bga",
  "needsRedirect",
  "jan1offset",
  "jun1offset",
]);

export function parseIcimsJobUrl(url: string): string | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));
    if (!parsed.pathname.includes("/jobs/")) return null;

    for (const param of STRIP_QUERY_PARAMS) {
      parsed.searchParams.delete(param);
    }

    parsed.searchParams.set("in_iframe", "1");
    parsed.searchParams.set("mode", "job");

    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchIcimsHtml(fetchUrl: string): Promise<string | null> {
  const headers: Record<string, string> = {
    ...FETCH_HEADERS,
    Referer: "https://www.icims.com/",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "iframe",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }

    try {
      const response = await fetch(fetchUrl, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(35_000),
      });

      if (!response.ok) continue;

      const html = await response.text();
      if (html.includes("Human Verification")) {
        continue;
      }

      return html;
    } catch {
      continue;
    }
  }

  return null;
}

function extractIcimsDescription(html: string): string | null {
  const structured = extractJobPostingFromHtml(html);
  if (structured) return structured.text;

  const $ = cheerio.load(html);
  const selectors = [
    ".iCIMS_JobContent",
    ".iCIMS_JobDescription",
    ".iCIMS_InfoMsg",
    "[class*='JobDescription']",
    "[data-testid='job-description']",
    "div[itemprop='description']",
  ];

  for (const selector of selectors) {
    const text = $(selector).text().replace(/\s+/g, " ").trim();
    if (text.length > 100) return text;
  }

  const title = $('h1[itemprop="title"], .iCIMS_JobHeaderTitle, h1').first().text().trim();
  const body = $("body").text().replace(/\s+/g, " ").trim();
  if (title && body.length > 200) {
    return `Job Title: ${title}\n\n${body}`.slice(0, 30000);
  }

  return null;
}

export async function fetchIcimsJob(url: string): Promise<string | null> {
  const fetchUrl = parseIcimsJobUrl(url);
  if (!fetchUrl) return null;

  const html = (await fetchIcimsHtml(fetchUrl)) ?? (await fetchHtml(fetchUrl));
  if (!html) {
    return null;
  }

  return extractIcimsDescription(html);
}
