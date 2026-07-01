import * as cheerio from "cheerio";

export interface AshbyJobIds {
  orgSlug: string;
  jobId: string;
}

export function parseAshbyUrl(url: string): AshbyJobIds | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("ashbyhq.com")) return null;

    const pathMatch = parsed.pathname.match(
      /\/([^/]+)\/([0-9a-f-]{36})\/?$/i
    );
    if (pathMatch) {
      return { orgSlug: pathMatch[1], jobId: pathMatch[2] };
    }
  } catch {
    return null;
  }

  return null;
}

function stripHtml(html: string): string {
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

interface JobPostingSchema {
  "@type"?: string;
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { name?: string } | { name?: string }[];
  employmentType?: string | string[];
  datePosted?: string;
}

function parseJobPostingJson(raw: string): JobPostingSchema | null {
  try {
    const data = JSON.parse(raw) as JobPostingSchema | JobPostingSchema[];
    if (Array.isArray(data)) {
      return data.find((item) => item["@type"] === "JobPosting") ?? null;
    }
    return data["@type"] === "JobPosting" ? data : null;
  } catch {
    return null;
  }
}

export function extractAshbyJobFromHtml(html: string): string | null {
  const $ = cheerio.load(html);

  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(el).html();
    if (!raw) continue;

    const posting = parseJobPostingJson(raw);
    if (!posting?.description) continue;

    const description = stripHtml(posting.description);
    if (description.length < 50) continue;

    const company = posting.hiringOrganization?.name;
    const locations = Array.isArray(posting.jobLocation)
      ? posting.jobLocation.map((l) => l.name).filter(Boolean).join("; ")
      : posting.jobLocation?.name;
    const employmentType = Array.isArray(posting.employmentType)
      ? posting.employmentType.join(", ")
      : posting.employmentType;

    return [
      posting.title ? `Job Title: ${posting.title.trim()}` : "",
      company ? `Company: ${company}` : "",
      locations ? `Location: ${locations}` : "",
      employmentType ? `Employment Type: ${employmentType}` : "",
      "",
      description,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return null;
}

export async function fetchAshbyJob(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    return extractAshbyJobFromHtml(html);
  } catch {
    return null;
  }
}

export function isAshbyUrl(url: string): boolean {
  return url.toLowerCase().includes("ashbyhq.com");
}
