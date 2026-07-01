import {
  extractJobPostingFromHtml,
  extractFromNextData,
} from "./html-extract";
import { fetchHtml } from "./fetch-page";

export async function fetchAshbyJob(url: string): Promise<string | null> {
  const html = await fetchHtml(url);
  if (!html) return null;

  const structured = extractJobPostingFromHtml(html);
  return structured?.text ?? null;
}

export function isAshbyUrl(url: string): boolean {
  return url.toLowerCase().includes("ashbyhq.com");
}
