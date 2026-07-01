import * as cheerio from "cheerio";

export interface GreenhouseJobIds {
  board: string;
  jobId: string;
}

export function normalizeIncomingUrl(url: string): string {
  let cleaned = url.trim().replace(/&amp;/gi, "&");

  // Slack wraps links as <url|label> — strip the label suffix if present.
  const schemeEnd = cleaned.indexOf("://");
  const pipeIndex = cleaned.indexOf("|");
  if (pipeIndex > -1 && pipeIndex > schemeEnd) {
    cleaned = cleaned.slice(0, pipeIndex);
  }

  return cleaned.replace(/[>,)\].]+$/, "");
}

export function parseGreenhouseUrl(url: string): GreenhouseJobIds | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));

    const pathMatch = parsed.pathname.match(/\/([^/]+)\/jobs\/(\d+)\/?$/);
    if (pathMatch) {
      return { board: pathMatch[1], jobId: pathMatch[2] };
    }

    const board = parsed.searchParams.get("for");
    const rawToken = parsed.searchParams.get("token");
    const token = rawToken?.match(/^(\d+)/)?.[1];
    if (board && token) {
      return { board, jobId: token };
    }

    const ghJid = parsed.searchParams.get("gh_jid")?.match(/^(\d+)/)?.[1];
    if (board && ghJid) {
      return { board, jobId: ghJid };
    }
  } catch {
    return null;
  }

  return null;
}

function stripHtml(html: string): string {
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return cheerio.load(`<div>${text}</div>`)("div").text().replace(/\s+/g, " ").trim();
}

interface GreenhouseApiJob {
  title: string;
  content: string;
  location?: { name?: string };
  departments?: { name?: string }[];
  offices?: { name?: string }[];
  absolute_url?: string;
}

export async function fetchGreenhouseJobViaApi(
  board: string,
  jobId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`,
      {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!response.ok) return null;

    const job = (await response.json()) as GreenhouseApiJob;
    const departments =
      job.departments?.map((d) => d.name).filter(Boolean).join(", ") || "Unknown";
    const offices =
      job.offices?.map((o) => o.name).filter(Boolean).join(", ") || "";
    const location = job.location?.name || offices || "Unknown";
    const content = stripHtml(job.content);

    if (!content || content.length < 50) return null;

    return [
      `Job Title: ${job.title}`,
      `Location: ${location}`,
      `Department: ${departments}`,
      job.absolute_url ? `URL: ${job.absolute_url}` : "",
      "",
      content,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}

export function extractMetaFromHtml(html: string): string {
  const $ = cheerio.load(html);
  const parts: string[] = [];

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text() ||
    "";
  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";

  if (title) parts.push(`Page Title: ${decodeHtmlEntities(title)}`);
  if (description) parts.push(decodeHtmlEntities(description));

  return parts.join("\n\n").trim();
}

export function parseJobTitleFromPageTitle(pageTitle: string): string | null {
  const match = pageTitle.match(
    /Job Application for (.+?) at /i
  );
  return match?.[1]?.trim() ?? null;
}

export async function findGreenhouseJobByTitle(
  board: string,
  title: string
): Promise<GreenhouseJobIds | null> {
  try {
    const response = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`,
      {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      jobs?: { id: number; title: string }[];
    };
    const normalized = title.trim().toLowerCase();
    const job = data.jobs?.find((j) => j.title.trim().toLowerCase() === normalized);

    return job ? { board, jobId: String(job.id) } : null;
  } catch {
    return null;
  }
}

export function isGreenhouseUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("greenhouse.io") || lower.includes("grnh.se");
}
