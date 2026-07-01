import * as cheerio from "cheerio";

interface JobPostingSchema {
  "@type"?: string;
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { name?: string } | { name?: string }[];
  employmentType?: string | string[];
  baseSalary?: { value?: { value?: number; unitText?: string } };
  datePosted?: string;
}

function stripHtml(html: string): string {
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
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

function formatJobPosting(posting: JobPostingSchema): string | null {
  if (!posting.description) return null;

  const description = stripHtml(posting.description);
  if (description.length < 50) return null;

  const company = posting.hiringOrganization?.name;
  const locations = Array.isArray(posting.jobLocation)
    ? posting.jobLocation.map((l) => l.name).filter(Boolean).join("; ")
    : posting.jobLocation?.name;
  const employmentType = Array.isArray(posting.employmentType)
    ? posting.employmentType.join(", ")
    : posting.employmentType;
  const salary = posting.baseSalary?.value;

  return [
    posting.title ? `Job Title: ${posting.title.trim()}` : "",
    company ? `Company: ${company}` : "",
    locations ? `Location: ${locations}` : "",
    employmentType ? `Employment Type: ${employmentType}` : "",
    salary?.value
      ? `Salary: ${salary.value}${salary.unitText ? ` ${salary.unitText}` : ""}`
      : "",
    "",
    description,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface StructuredExtractResult {
  text: string;
  structured: true;
}

export function extractJobPostingFromHtml(
  html: string
): StructuredExtractResult | null {
  const $ = cheerio.load(html);

  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(el).html();
    if (!raw) continue;

    const posting = parseJobPostingJson(raw);
    if (!posting) continue;

    const text = formatJobPosting(posting);
    if (text) return { text, structured: true };
  }

  return null;
}

export function extractFromNextData(html: string): string | null {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match?.[1]) return null;

  try {
    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: Record<string, unknown> };
    };
    const pageProps = data.props?.pageProps;
    if (!pageProps) return null;

    const candidates = [
      pageProps.job,
      pageProps.jobPosting,
      pageProps.posting,
      pageProps.data,
    ].filter(Boolean);

    for (const item of candidates) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const title = String(record.title || record.name || "");
      const description = String(
        record.description ||
          record.content ||
          record.jobDescription ||
          record.body ||
          ""
      );
      const plain = stripHtml(description);
      if (plain.length < 50) continue;

      return [
        title ? `Job Title: ${title}` : "",
        record.company ? `Company: ${String(record.company)}` : "",
        "",
        plain,
      ]
        .filter(Boolean)
        .join("\n");
    }
  } catch {
    return null;
  }

  return null;
}
