import * as cheerio from "cheerio";
import { normalizeIncomingUrl } from "./greenhouse";

const STRIP_QUERY_PARAMS = new Set([
  "jr_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "lang",
  "mobile",
  "width",
  "height",
  "bga",
  "needsRedirect",
  "jan1offset",
  "jun1offset",
]);

export const FETCH_TIMEOUT_MS = 35_000;

export const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export function prepareFetchUrl(url: string): string {
  const normalized = normalizeIncomingUrl(url);

  try {
    const parsed = new URL(normalized);

    for (const param of STRIP_QUERY_PARAMS) {
      parsed.searchParams.delete(param);
    }

    if (
      parsed.hostname.includes("icims.com") &&
      parsed.pathname.includes("/jobs/")
    ) {
      parsed.searchParams.set("in_iframe", "1");
    }

    return parsed.toString();
  } catch {
    return normalized;
  }
}

async function fetchWithTimeout(
  fetchUrl: string,
  headers: Record<string, string>
): Promise<Response | null> {
  try {
    return await fetch(fetchUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

export async function fetchHtml(url: string): Promise<string | null> {
  const fetchUrl = prepareFetchUrl(url);

  const headers: Record<string, string> = { ...FETCH_HEADERS };

  if (fetchUrl.includes("icims.com")) {
    headers.Referer = "https://www.icims.com/";
    headers["Sec-Fetch-Dest"] = "iframe";
    headers["Sec-Fetch-Mode"] = "navigate";
    headers["Sec-Fetch-Site"] = "cross-site";
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetchWithTimeout(fetchUrl, headers);
    if (response?.ok) {
      return response.text();
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return null;
}

function stripHtml(html: string): string {
  if (!html.includes("<")) return html.replace(/\s+/g, " ").trim();
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

export function parseDoverJobId(url: string): string | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));
    if (!parsed.hostname.includes("dover.com")) return null;

    const match = parsed.pathname.match(
      /\/apply\/[^/]+\/([0-9a-f-]{36})\/?$/i
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function fetchDoverJob(url: string): Promise<string | null> {
  const jobId = parseDoverJobId(url);
  if (!jobId) return null;

  const endpoints = [
    `https://app.dover.com/api/v1/careers/${jobId}`,
    `https://app.dover.com/api/v1/public/job_postings/${jobId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          ...FETCH_HEADERS,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("json")) continue;

      const data = (await response.json()) as Record<string, unknown>;
      const title = String(data.title || data.name || "");
      const description = String(
        data.description || data.job_description || data.content || ""
      );
      const plain = stripHtml(description);
      if (plain.length < 50) continue;

      return [
        title ? `Job Title: ${title}` : "",
        data.company_name ? `Company: ${String(data.company_name)}` : "",
        "",
        plain,
      ]
        .filter(Boolean)
        .join("\n");
    } catch {
      continue;
    }
  }

  return null;
}
