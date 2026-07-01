import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "./fetch-page";
import { normalizeIncomingUrl } from "./greenhouse";

const JOBDIVA_BASE = "https://ws.jobdiva.com/candPortal/rest/";
const INITIAL_BASIC = "YXhlbG9uOmF4ZWxvbg==";

export interface JobdivaJobIds {
  portalToken: string;
  jobId: string;
}

export function isJobdivaUrl(url: string): boolean {
  const normalized = normalizeIncomingUrl(url).toLowerCase();
  return normalized.includes("jobdiva.com");
}

export function parseJobdivaUrl(url: string): JobdivaJobIds | null {
  const normalized = normalizeIncomingUrl(url);

  const hashMatch = normalized.match(/#\/jobs\/(\d+)/i);
  const jobId = hashMatch?.[1];
  if (!jobId) return null;

  try {
    const parsed = new URL(normalized);
    const portalToken = parsed.searchParams.get("a");
    if (!portalToken) return null;
    return { portalToken, jobId };
  } catch {
    return null;
  }
}

interface JobdivaAuth {
  token: string;
  auth: string;
  a: string;
  portalID: number;
  compid: number;
}

async function fetchJobdivaAuth(portalToken: string): Promise<JobdivaAuth | null> {
  try {
    const response = await fetch(`${JOBDIVA_BASE}auth/a`, {
      headers: {
        Authorization: `Basic ${INITIAL_BASIC}`,
        portalID: "1",
        a: portalToken,
        compid: "-1",
        Accept: "application/json",
        "User-Agent": FETCH_HEADERS["User-Agent"],
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as JobdivaAuth;
    if (!data.token || !data.auth) return null;
    return data;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return cheerio.load(html).root().text().replace(/\s+/g, " ").trim();
}

export async function fetchJobdivaJob(url: string): Promise<string | null> {
  const ids = parseJobdivaUrl(url);
  if (!ids) return null;

  const auth = await fetchJobdivaAuth(ids.portalToken);
  if (!auth) return null;

  try {
    const detailUrl = `${JOBDIVA_BASE}job/getdetailbyjobid/${ids.jobId}?compid=${auth.compid}`;
    const response = await fetch(detailUrl, {
      headers: {
        ...FETCH_HEADERS,
        Accept: "application/json",
        Authorization: `Basic ${auth.auth}`,
        token: auth.token,
        portalID: String(auth.portalID),
        a: auth.a,
        compid: String(auth.compid),
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      job?: {
        title?: string;
        refNo?: string;
        company?: string;
        positionType?: string;
        payRate?: string;
        payFrequency?: string;
        workingRemote?: number;
        mainLocation?: { city?: string; state?: string; country?: string };
        jobDescription?: string;
      };
    };

    const job = data.job;
    if (!job?.jobDescription) return null;

    const description = stripHtml(job.jobDescription);
    if (description.length < 50) return null;

    const location = [
      job.mainLocation?.city,
      job.mainLocation?.state,
      job.mainLocation?.country,
    ]
      .filter(Boolean)
      .join(", ");

    const remote =
      job.workingRemote != null && job.workingRemote > 0
        ? `Remote: ${job.workingRemote}%`
        : "";

    return [
      job.title ? `Job Title: ${job.title}` : "",
      job.company ? `Company: ${job.company}` : "",
      job.refNo ? `Reference: ${job.refNo}` : "",
      job.positionType ? `Employment Type: ${job.positionType}` : "",
      job.payRate
        ? `Pay: ${job.payRate}${job.payFrequency ? ` ${job.payFrequency}` : ""}`
        : "",
      location ? `Location: ${location}` : "",
      remote,
      "",
      description,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}
