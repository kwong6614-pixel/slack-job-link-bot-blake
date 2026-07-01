import * as cheerio from "cheerio";
import {
  extractJobPostingFromHtml,
  extractFromNextData,
} from "./html-extract";
import {
  extractMetaFromHtml,
  fetchGreenhouseJobViaApi,
  findGreenhouseJobByTitle,
  isGreenhouseUrl,
  normalizeIncomingUrl,
  parseGreenhouseUrl,
  parseJobTitleFromPageTitle,
} from "./greenhouse";
import { fetchAdpJob, isAdpUrl } from "./adp";
import { fetchAshbyJob, isAshbyUrl } from "./ashby";
import { fetchBairesdevJob, isBairesdevUrl } from "./bairesdev";
import { fetchBullhornJob, isBullhornUrl } from "./bullhorn";
import { fetchDoverJob, fetchHtml, parseDoverJobId } from "./fetch-page";
import { fetchGemJob, isGemUrl } from "./gem";
import { fetchHibobJob, isHibobUrl } from "./hibob";
import { fetchIcimsJob, isIcimsUrl } from "./icims";
import { fetchJobdivaJob, isJobdivaUrl } from "./jobdiva";
import { fetchUltiproJob, isUltiproUrl } from "./ultipro";

export interface ScrapeResult {
  text: string;
  partial: boolean;
  error?: string;
  notJobPage?: boolean;
  /** True when text came from JSON-LD or API (high confidence). */
  structured?: boolean;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractGeneric($: cheerio.CheerioAPI): string {
  $("script, style, nav, header, footer, noscript").remove();

  const selectors = [
    "[class*='job-description']",
    "[class*='jobDescription']",
    "[class*='JobDescription']",
    "[id*='job-description']",
    "[data-testid*='job']",
    "main",
    "article",
    "[role='main']",
  ];

  for (const selector of selectors) {
    const text = normalizeWhitespace($(selector).text());
    if (text.length > 300) return text;
  }

  return normalizeWhitespace($("body").text());
}

const JD_URL_PATTERNS = [
  /greenhouse\.io/i,
  /grnh\.se/i,
  /lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /icims\.com/i,
  /smartrecruiters\.com/i,
  /bamboohr\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /dice\.com/i,
  /dover\.com/i,
  /clearcompany\.com/i,
  /jobdiva\.com/i,
  /gem\.com/i,
  /bairesdev\.com/i,
  /\/jobs?\//i,
  /\/job-detail\//i,
  /\/careers?\//i,
  /\/postings?\//i,
  /\/positions?\//i,
  /\/apply\//i,
  /careers\./i,
  /jobs\./i,
];

const JD_CONTENT_KEYWORDS = [
  "responsibilities",
  "qualifications",
  "requirements",
  "job description",
  "what you will do",
  "what you'll do",
  "about the role",
  "about this role",
  "we are looking for",
  "years of experience",
  "employment type",
  "full-time",
  "full time",
  "benefits",
  "apply now",
  "equal opportunity",
];

function looksLikeJobPage(
  url: string,
  text: string,
  structured: boolean
): { ok: true } | { ok: false; reason: string } {
  if (structured && text.length >= 50) {
    return { ok: true };
  }

  const urlMatches = JD_URL_PATTERNS.some((pattern) => pattern.test(url));
  const lower = text.toLowerCase();
  const keywordHits = JD_CONTENT_KEYWORDS.filter((kw) =>
    lower.includes(kw)
  ).length;

  if (text.length < 50) {
    return {
      ok: false,
      reason: "Could not extract meaningful job description text",
    };
  }

  if (urlMatches && keywordHits >= 1 && text.length >= 100) {
    return { ok: true };
  }

  if (keywordHits >= 2 && text.length >= 150) {
    return { ok: true };
  }

  if (text.startsWith("Job Title:") && text.length >= 200) {
    return { ok: true };
  }

  if (!urlMatches && keywordHits === 0) {
    return {
      ok: false,
      reason: "URL and page content do not appear to be a job description",
    };
  }

  if (text.length < 120) {
    return {
      ok: false,
      reason: "Insufficient content to analyze as a job description",
    };
  }

  return { ok: true };
}

function extractTextFromHtml(html: string, url: string): string {
  const structured = extractJobPostingFromHtml(html);
  if (structured) return structured.text;

  const nextData = extractFromNextData(html);
  if (nextData) return nextData;

  const $ = cheerio.load(html);
  let text = extractGeneric($);

  const meta = extractMetaFromHtml(html);
  if (meta && text.length < 800) {
    text = [meta, text].filter(Boolean).join("\n\n");
  }

  return text.slice(0, 30000);
}

async function scrapeGreenhouse(url: string): Promise<{
  text: string | null;
  structured: boolean;
}> {
  const normalizedUrl = normalizeIncomingUrl(url);
  const ids = parseGreenhouseUrl(normalizedUrl);
  if (ids) {
    const apiText = await fetchGreenhouseJobViaApi(ids.board, ids.jobId);
    if (apiText) return { text: apiText, structured: true };
  }

  const html = await fetchHtml(normalizedUrl);
  if (!html) return { text: null, structured: false };

  const structured = extractJobPostingFromHtml(html);
  if (structured) return { text: structured.text, structured: true };

  const pageTitle =
    cheerio.load(html)("title").text() || extractMetaFromHtml(html);
  const jobTitle = parseJobTitleFromPageTitle(pageTitle);
  const board =
    parseGreenhouseUrl(normalizedUrl)?.board ||
    new URL(normalizedUrl).searchParams.get("for") ||
    null;

  if (board && jobTitle) {
    const match = await findGreenhouseJobByTitle(board, jobTitle);
    if (match) {
      const apiText = await fetchGreenhouseJobViaApi(match.board, match.jobId);
      if (apiText) return { text: apiText, structured: true };
    }
  }

  return { text: extractTextFromHtml(html, url), structured: false };
}

export async function scrapeJobDescription(url: string): Promise<ScrapeResult> {
  try {
    const normalizedUrl = normalizeIncomingUrl(url);
    let text = "";
    let structured = false;

    if (isGreenhouseUrl(normalizedUrl)) {
      const gh = await scrapeGreenhouse(normalizedUrl);
      if (gh.text) {
        text = gh.text;
        structured = gh.structured;
      }
    }

    if (!text && parseDoverJobId(normalizedUrl)) {
      const doverText = await fetchDoverJob(normalizedUrl);
      if (doverText) {
        text = doverText;
        structured = true;
      }
    }

    if (!text && isAshbyUrl(normalizedUrl)) {
      const ashbyText = await fetchAshbyJob(normalizedUrl);
      if (ashbyText) {
        text = ashbyText;
        structured = true;
      }
    }

    let partialFromApi = false;

    if (!text && isAdpUrl(normalizedUrl)) {
      const adpText = await fetchAdpJob(normalizedUrl);
      if (adpText) {
        text = adpText;
        structured = true;
      }
    }

    if (!text && isUltiproUrl(normalizedUrl)) {
      const ultipro = await fetchUltiproJob(normalizedUrl);
      if (ultipro) {
        text = ultipro.text;
        structured = true;
        partialFromApi = ultipro.partial;
      }
    }

    if (!text && isBullhornUrl(normalizedUrl)) {
      const bullhornText = await fetchBullhornJob(normalizedUrl);
      if (bullhornText) {
        text = bullhornText;
        structured = true;
      }
    }

    if (!text && isHibobUrl(normalizedUrl)) {
      const hibobText = await fetchHibobJob(normalizedUrl);
      if (hibobText) {
        text = hibobText;
        structured = true;
      }
    }

    if (!text && isJobdivaUrl(normalizedUrl)) {
      const jobdivaText = await fetchJobdivaJob(normalizedUrl);
      if (jobdivaText) {
        text = jobdivaText;
        structured = true;
      }
    }

    if (!text && isGemUrl(normalizedUrl)) {
      const gemText = await fetchGemJob(normalizedUrl);
      if (gemText) {
        text = gemText;
        structured = true;
      }
    }

    if (!text && isBairesdevUrl(normalizedUrl)) {
      const bairesdevText = await fetchBairesdevJob(normalizedUrl);
      if (bairesdevText) {
        text = bairesdevText;
        structured = true;
      }
    }

    if (!text && isIcimsUrl(normalizedUrl)) {
      const icimsText = await fetchIcimsJob(normalizedUrl);
      if (icimsText) {
        text = icimsText;
        structured = true;
      }
    }

    if (!text) {
      const html = await fetchHtml(normalizedUrl);
      if (!html) {
        const icimsBlocked = isIcimsUrl(normalizedUrl);
        return {
          text: "",
          partial: false,
          error: icimsBlocked
            ? "iCIMS blocked this request (AWS WAF captcha — cannot scrape server-side)"
            : "Failed to fetch page",
        };
      }

      const ld = extractJobPostingFromHtml(html);
      if (ld) {
        text = ld.text;
        structured = true;
      } else {
        text = extractTextFromHtml(html, normalizedUrl);
      }
    }

    if (!text || text.length < 50) {
      return {
        text: text || "",
        partial: false,
        error: "Could not extract meaningful job description text",
        notJobPage: true,
      };
    }

    const pageCheck = looksLikeJobPage(normalizedUrl, text, structured);
    if (!pageCheck.ok) {
      return {
        text,
        partial: false,
        error: pageCheck.reason,
        notJobPage: true,
      };
    }

    return {
      text,
      partial: partialFromApi || (!structured && text.length < 800),
      structured,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scrape error";
    return { text: "", partial: false, error: message };
  }
}

export function extractUrls(text: string): string[] {
  const urls: string[] = [];

  for (const match of text.matchAll(/<(https?:\/\/[^>]+)>/gi)) {
    urls.push(normalizeIncomingUrl(match[1]));
  }

  for (const match of text.matchAll(/https?:\/\/[^\s<>()]+/gi)) {
    urls.push(normalizeIncomingUrl(match[0]));
  }

  return [...new Set(urls)];
}
