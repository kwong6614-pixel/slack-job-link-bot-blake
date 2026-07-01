import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";

export interface GemJobIds {
  boardId: string;
  extId: string;
}

export function isGemUrl(url: string): boolean {
  try {
    const host = new URL(normalizeIncomingUrl(url)).hostname.toLowerCase();
    return host === "jobs.gem.com";
  } catch {
    return false;
  }
}

export function parseGemUrl(url: string): GemJobIds | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { boardId: parts[0], extId: parts[1] };
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

export async function fetchGemJob(url: string): Promise<string | null> {
  const ids = parseGemUrl(url);
  if (!ids) return null;

  const payload = [
    {
      operationName: "ExternalJobPostingQuery",
      variables: { boardId: ids.boardId, extId: ids.extId },
      query: `query ExternalJobPostingQuery($boardId: String!, $extId: String!) {
        oatsExternalJobPosting(boardId: $boardId, extId: $extId) {
          id
          title
          descriptionHtml
          extId
          locations { name city isoCountry isRemote }
          job {
            department { name }
            locationType
            employmentType
          }
          jobPostSectionHtml { introHtml outroHtml }
          compensationHtml
        }
      }`,
    },
  ];

  try {
    const response = await fetch(
      "https://jobs.gem.com/api/public/graphql/batch",
      {
        method: "POST",
        headers: {
          ...FETCH_HEADERS,
          "Content-Type": "application/json",
          batch: "true",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      data?: {
        oatsExternalJobPosting?: {
          title?: string;
          descriptionHtml?: string;
          locations?: {
            name?: string;
            city?: string;
            isoCountry?: string;
            isRemote?: boolean;
          }[];
          job?: {
            department?: { name?: string };
            locationType?: string;
            employmentType?: string;
          };
          jobPostSectionHtml?: { introHtml?: string; outroHtml?: string };
          compensationHtml?: string;
        };
      };
    }[];

    const posting = data[0]?.data?.oatsExternalJobPosting;
    if (!posting?.descriptionHtml) return null;

    const descriptionParts = [
      posting.jobPostSectionHtml?.introHtml,
      posting.descriptionHtml,
      posting.jobPostSectionHtml?.outroHtml,
      posting.compensationHtml,
    ]
      .filter((part): part is string => Boolean(part))
      .map(stripHtml);

    const description = descriptionParts.join("\n\n").trim();
    if (description.length < 50) return null;

    const location = (posting.locations || [])
      .map((loc) =>
        [loc.name || loc.city, loc.isoCountry, loc.isRemote ? "Remote" : ""]
          .filter(Boolean)
          .join(", ")
      )
      .filter(Boolean)
      .join("; ");

    return [
      posting.title ? `Job Title: ${posting.title}` : "",
      posting.job?.department?.name
        ? `Department: ${posting.job.department.name}`
        : "",
      posting.job?.employmentType
        ? `Employment Type: ${posting.job.employmentType}`
        : "",
      posting.job?.locationType ? `Work Type: ${posting.job.locationType}` : "",
      location ? `Location: ${location}` : "",
      "",
      description,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}
