import { FETCH_HEADERS } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";

export interface UltiproJobIds {
  baseUrl: string;
  companyCode: string;
  boardId: string;
  opportunityId: string;
}

export function isUltiproUrl(url: string): boolean {
  try {
    const host = new URL(normalizeIncomingUrl(url)).hostname.toLowerCase();
    return host.includes("ultipro.com") || host.includes("ultipro.ca");
  } catch {
    return false;
  }
}

export function parseUltiproUrl(url: string): UltiproJobIds | null {
  try {
    const parsed = new URL(normalizeIncomingUrl(url));
    const baseMatch = parsed.href.match(
      /(https:\/\/recruiting\d*\.ultipro\.(?:com|ca))/i
    );
    const companyMatch = parsed.pathname.match(
      /\/([^/]+)\/JobBoard\/([^/]+)/i
    );
    const opportunityId = parsed.searchParams.get("opportunityId");

    if (!baseMatch || !companyMatch || !opportunityId) return null;

    return {
      baseUrl: baseMatch[1],
      companyCode: companyMatch[1],
      boardId: companyMatch[2],
      opportunityId,
    };
  } catch {
    return null;
  }
}

interface UltiproOpportunity {
  Id?: string;
  Title?: string;
  RequisitionNumber?: string;
  FullTime?: boolean;
  JobCategoryName?: string;
  PostedDate?: string;
  BriefDescription?: string;
  Locations?: {
    Address?: {
      City?: string;
      State?: { Code?: string };
      Country?: { Code?: string };
    };
  }[];
  JobLocationType?: number;
}

const LOCATION_TYPE: Record<number, string> = {
  1: "On-site",
  2: "Hybrid",
  3: "Remote",
};

function formatLocation(opp: UltiproOpportunity): string {
  const loc = opp.Locations?.[0]?.Address;
  if (!loc) return "";
  const parts = [loc.City, loc.State?.Code, loc.Country?.Code].filter(Boolean);
  return parts.join(", ");
}

async function searchOpportunity(
  ids: UltiproJobIds
): Promise<UltiproOpportunity | null> {
  const apiUrl = `${ids.baseUrl}/${ids.companyCode}/JobBoard/${ids.boardId}/JobBoardView/LoadSearchResults`;

  const payload = {
    opportunitySearch: {
      Top: 50,
      Skip: 0,
      QueryString: "",
      OrderBy: [
        {
          Value: "postedDateDesc",
          PropertyName: "PostedDate",
          Ascending: false,
        },
      ],
      Filters: [
        { t: "TermsSearchFilterDto", fieldName: 4, extra: null, values: [] },
        { t: "TermsSearchFilterDto", fieldName: 5, extra: null, values: [] },
        { t: "TermsSearchFilterDto", fieldName: 6, extra: null, values: [] },
        { t: "TermsSearchFilterDto", fieldName: 37, extra: null, values: [] },
      ],
    },
    matchCriteria: {
      PreferredJobs: [],
      Educations: [],
      LicenseAndCertifications: [],
      Skills: [],
      hasNoLicenses: false,
      SkippedSkills: [],
    },
  };

  let skip = 0;
  const pageSize = 50;

  while (skip < 500) {
    payload.opportunitySearch.Skip = skip;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        ...FETCH_HEADERS,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      opportunities?: UltiproOpportunity[];
      totalCount?: number;
    };

    const match = (data.opportunities || []).find(
      (opp) => opp.Id === ids.opportunityId
    );
    if (match) return match;

    const total = data.totalCount ?? 0;
    skip += pageSize;
    if (skip >= total || !(data.opportunities || []).length) break;
  }

  return null;
}

export async function fetchUltiproJob(
  url: string
): Promise<{ text: string; partial: boolean } | null> {
  const ids = parseUltiproUrl(url);
  if (!ids) return null;

  try {
    const opp = await searchOpportunity(ids);
    if (!opp) return null;

    const description = (opp.BriefDescription || "").replace(/\s+/g, " ").trim();
    if (description.length < 50) return null;

    const location = formatLocation(opp);
    const locationType = opp.JobLocationType
      ? LOCATION_TYPE[opp.JobLocationType]
      : "";

    const text = [
      opp.Title ? `Job Title: ${opp.Title}` : "",
      opp.RequisitionNumber ? `Requisition: ${opp.RequisitionNumber}` : "",
      opp.JobCategoryName ? `Category: ${opp.JobCategoryName}` : "",
      opp.FullTime !== undefined
        ? `Employment Type: ${opp.FullTime ? "Full Time" : "Part Time"}`
        : "",
      location ? `Location: ${location}` : "",
      locationType ? `Work Type: ${locationType}` : "",
      "",
      description,
    ]
      .filter(Boolean)
      .join("\n");

    return { text, partial: description.length < 800 };
  } catch {
    return null;
  }
}
