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

export function parseIcimsJobUrl(url: string): string | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));
    if (!parsed.pathname.includes("/jobs/")) return null;

    parsed.searchParams.set("in_iframe", "1");
    parsed.searchParams.set("mode", "job");

    for (const param of [
      "mobile",
      "width",
      "height",
      "bga",
      "needsRedirect",
      "jan1offset",
      "jun1offset",
    ]) {
      parsed.searchParams.delete(param);
    }

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
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(fetchUrl, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(35_000),
      });

      if (!response.ok) continue;

      const html = await response.text();
      if (
        html.includes("Human Verification") ||
        html.includes("captcha-container")
      ) {
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
