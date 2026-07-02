import * as cheerio from "cheerio";
import { fetchHtml } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";
import { extractJobPostingFromHtml } from "./html-extract";
import { fetchViaJinaReader, isCloudflareChallenge } from "./reader-proxy";

export function isGustoUrl(url: string): boolean {
  try {
    const host = new URL(normalizeIncomingUrl(url)).hostname.toLowerCase();
    return host === "jobs.gusto.com";
  } catch {
    return false;
  }
}

function extractGustoFromHtml(html: string): string | null {
  const structured = extractJobPostingFromHtml(html);
  if (structured) return structured.text;

  const $ = cheerio.load(html);
  const selectors = [
    "[class*='job-description']",
    "[class*='JobDescription']",
    "main",
    "article",
  ];

  for (const selector of selectors) {
    const text = $(selector).text().replace(/\s+/g, " ").trim();
    if (text.length > 200) return text;
  }

  return null;
}

export async function fetchGustoJob(url: string): Promise<string | null> {
  const normalized = normalizeIncomingUrl(url);

  const html = await fetchHtml(normalized);
  if (html && !isCloudflareChallenge(html)) {
    const direct = extractGustoFromHtml(html);
    if (direct && direct.length >= 100) return direct;
  }

  return fetchViaJinaReader(normalized);
}
