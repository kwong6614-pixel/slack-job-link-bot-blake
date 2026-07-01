import * as cheerio from "cheerio";
import {
  extractMetaFromHtml,
  fetchGreenhouseJobViaApi,
  findGreenhouseJobByTitle,
  isGreenhouseUrl,
  parseGreenhouseUrl,
  parseJobTitleFromPageTitle,
} from "./greenhouse";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export interface ScrapeResult {
  text: string;
  partial: boolean;
  error?: string;
  /** True when the page is not a job description (should be Failed, not Rejected). */
  notJobPage?: boolean;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractFromGreenhouse($: cheerio.CheerioAPI): string {
  const selectors = [
    "#content",
    ".job-post",
    ".job__description",
    "[data-qa='job-description']",
    ".job__body",
    ".job-post-content",
  ];
  for (const selector of selectors) {
    const text = normalizeWhitespace($(selector).text());
    if (text.length > 200) return text;
  }
  return "";
}

function extractFromLever($: cheerio.CheerioAPI): string {
  const selectors = [
    ".content",
    ".posting-page",
    ".section-wrapper",
    ".posting-categories",
  ];
  for (const selector of selectors) {
    const text = normalizeWhitespace($(selector).text());
    if (text.length > 200) return text;
  }
  return "";
}

function extractFromAshby($: cheerio.CheerioAPI): string {
  const selectors = [
    "[class*='JobDescription']",
    "[class*='jobDescription']",
    "main",
    "article",
  ];
  for (const selector of selectors) {
    const text = normalizeWhitespace($(selector).text());
    if (text.length > 200) return text;
  }
  return "";
}

function extractGeneric($: cheerio.CheerioAPI): string {
  $("script, style, nav, header, footer, noscript").remove();

  const selectors = [
    "[class*='job-description']",
    "[class*='jobDescription']",
    "[id*='job-description']",
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

function detectAts(url: string): "greenhouse" | "lever" | "ashby" | "generic" {
  const lower = url.toLowerCase();
  if (lower.includes("greenhouse.io") || lower.includes("grnh.se")) {
    return "greenhouse";
  }
  if (lower.includes("lever.co")) return "lever";
  if (lower.includes("ashbyhq.com")) return "ashby";
  return "generic";
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
  /breezy\.hr/i,
  /recruitee\.com/i,
  /jobs\.lever\.co/i,
  /\/jobs?\//i,
  /\/careers?\//i,
  /\/postings?\//i,
  /\/positions?\//i,
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
  text: string
): { ok: true } | { ok: false; reason: string } {
  const knownAts = detectAts(url) !== "generic";
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

  if (knownAts && text.length >= 50) {
    return { ok: true };
  }

  if (urlMatches && keywordHits >= 1 && text.length >= 150) {
    return { ok: true };
  }

  if (keywordHits >= 2 && text.length >= 200) {
    return { ok: true };
  }

  if (!urlMatches && keywordHits === 0) {
    return {
      ok: false,
      reason: "URL and page content do not appear to be a job description",
    };
  }

  if (text.length < 150) {
    return {
      ok: false,
      reason: "Insufficient content to analyze as a job description",
    };
  }

  return { ok: true };
}

function extractTextFromHtml(html: string, url: string): string {
  const $ = cheerio.load(html);
  const ats = detectAts(url);

  let text = "";
  switch (ats) {
    case "greenhouse":
      text = extractFromGreenhouse($);
      break;
    case "lever":
      text = extractFromLever($);
      break;
    case "ashby":
      text = extractFromAshby($);
      break;
    default:
      break;
  }

  if (text.length < 200) {
    text = extractGeneric(cheerio.load(html));
  }

  const meta = extractMetaFromHtml(html);
  if (meta && text.length < 800) {
    text = [meta, text].filter(Boolean).join("\n\n");
  }

  return text.slice(0, 30000);
}

async function scrapeGreenhouse(url: string): Promise<string | null> {
  const ids = parseGreenhouseUrl(url);
  if (ids) {
    const apiText = await fetchGreenhouseJobViaApi(ids.board, ids.jobId);
    if (apiText) return apiText;
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) return null;

  const html = await response.text();
  const pageTitle =
    cheerio.load(html)("title").text() || extractMetaFromHtml(html);

  const jobTitle = parseJobTitleFromPageTitle(pageTitle);
  const board =
    parseGreenhouseUrl(url)?.board ||
    new URL(url).searchParams.get("for") ||
    null;

  if (board && jobTitle) {
    const match = await findGreenhouseJobByTitle(board, jobTitle);
    if (match) {
      const apiText = await fetchGreenhouseJobViaApi(match.board, match.jobId);
      if (apiText) return apiText;
    }
  }

  return extractTextFromHtml(html, url);
}

async function fetchPageText(url: string): Promise<{ html: string; text: string } | null> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) return null;

  const html = await response.text();
  return { html, text: extractTextFromHtml(html, url) };
}

export async function scrapeJobDescription(url: string): Promise<ScrapeResult> {
  try {
    let text = "";

    if (isGreenhouseUrl(url)) {
      const greenhouseText = await scrapeGreenhouse(url);
      if (greenhouseText) text = greenhouseText;
    }

    if (!text) {
      const page = await fetchPageText(url);
      if (!page) {
        return {
          text: "",
          partial: false,
          error: "Failed to fetch page",
        };
      }
      text = page.text;
    }

    if (!text || text.length < 50) {
      return {
        text: text || "",
        partial: false,
        error: "Could not extract meaningful job description text",
        notJobPage: true,
      };
    }

    const pageCheck = looksLikeJobPage(url, text);
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
      partial: text.length < 800,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scrape error";
    return { text: "", partial: false, error: message };
  }
}

export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>()]+/gi;
  const matches = text.match(urlRegex) ?? [];
  const cleaned = matches.map((u) => u.replace(/[>,)\].]+$/, ""));

  return [...new Set(cleaned)];
}
