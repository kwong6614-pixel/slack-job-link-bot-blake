import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";

export interface BullhornJobIds {
  pluginBaseUrl: string;
  jobId: string;
}

interface BullhornSettings {
  companyName?: string;
  service?: {
    corpToken?: string;
    swimlane?: string;
    fields?: string[];
  };
}

export function isBullhornUrl(url: string): boolean {
  const normalized = normalizeIncomingUrl(url).toLowerCase();
  return (
    normalized.includes("bullhorn-oscp") ||
    normalized.includes("bullhornstaffing.com")
  );
}

export function parseBullhornUrl(url: string): BullhornJobIds | null {
  const normalized = normalizeIncomingUrl(url);

  const hashMatch = normalized.match(/#\/jobs\/(\d+)/i);
  const jobId = hashMatch?.[1] ?? null;
  if (!jobId) return null;

  try {
    const parsed = new URL(normalized);
    if (!parsed.pathname.includes("bullhorn-oscp")) return null;

    const basePath = parsed.pathname.replace(/\/?$/, "/");
    const pluginBaseUrl = `${parsed.origin}${basePath}`;

    return { pluginBaseUrl, jobId };
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

async function loadBullhornSettings(
  pluginBaseUrl: string
): Promise<BullhornSettings | null> {
  try {
    const settingsUrl = new URL("app.json", pluginBaseUrl).toString();
    const response = await fetch(settingsUrl, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;
    return (await response.json()) as BullhornSettings;
  } catch {
    return null;
  }
}

export async function fetchBullhornJob(url: string): Promise<string | null> {
  const ids = parseBullhornUrl(url);
  if (!ids) return null;

  const settings = await loadBullhornSettings(ids.pluginBaseUrl);
  const corpToken = settings?.service?.corpToken;
  const swimlane = settings?.service?.swimlane;
  if (!corpToken || !swimlane) return null;

  const fields = [
    "id",
    "title",
    "publicDescription",
    "employmentType",
    "address(city,state,countryName)",
    "publishedCategory(name)",
    "salary",
    "salaryUnit",
  ].join(",");

  const apiUrl = new URL(
    `https://public-rest${swimlane}.bullhornstaffing.com/rest-services/${corpToken}/query/JobOrder`
  );
  apiUrl.searchParams.set("where", `id=${ids.jobId}`);
  apiUrl.searchParams.set("fields", fields);
  apiUrl.searchParams.set("count", "1");

  try {
    const response = await fetch(apiUrl.toString(), {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      data?: {
        title?: string;
        publicDescription?: string;
        employmentType?: string;
        address?: { city?: string; state?: string; countryName?: string };
        publishedCategory?: { name?: string };
        salary?: number;
        salaryUnit?: string;
      }[];
    };

    const job = data.data?.[0];
    if (!job?.publicDescription) return null;

    const description = stripHtml(job.publicDescription);
    if (description.length < 50) return null;

    const location = [
      job.address?.city,
      job.address?.state,
      job.address?.countryName,
    ]
      .filter(Boolean)
      .join(", ");

    const salary =
      job.salary != null
        ? `Salary: ${job.salary}${job.salaryUnit ? ` ${job.salaryUnit}` : ""}`
        : "";

    return [
      job.title ? `Job Title: ${job.title}` : "",
      settings.companyName ? `Company: ${settings.companyName}` : "",
      job.publishedCategory?.name
        ? `Category: ${job.publishedCategory.name}`
        : "",
      job.employmentType ? `Employment Type: ${job.employmentType}` : "",
      location ? `Location: ${location}` : "",
      salary,
      "",
      description,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}
