import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function probeIcims() {
  const url =
    "https://careers-sunauto.icims.com/jobs/21676/operations-reporting-analyst/job?in_iframe=1";
  console.log("\n=== iCIMS ===");
  for (const headers of [
    FETCH_HEADERS,
    {
      ...FETCH_HEADERS,
      Referer: "https://www.icims.com/",
      "Sec-Fetch-Dest": "iframe",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site",
    },
  ]) {
    const r = await fetch(url, { headers, redirect: "follow" });
    const html = await r.text();
    const $ = cheerio.load(html);
    console.log("status", r.status, "len", html.length, "title", $("title").text());
    console.log("ld+json", $('script[type="application/ld+json"]').length);
    console.log("body", $("body").text().replace(/\s+/g, " ").slice(0, 200));
  }
}

async function probeJobdiva() {
  const portalA =
    "tqjdnwtd2nqo43kj8rdgg48zv695o700479ucz7rjp0s14dmmt4cc2gvpzfoandr";
  const jobId = "28785322";
  console.log("\n=== JobDiva ===");

  const html = await (
    await fetch(`https://www1.jobdiva.com/portal/?a=${portalA}`, {
      headers: FETCH_HEADERS,
    })
  ).text();
  console.log("portal html", html.length);
  for (const kw of ["api", "jobId", "28785322", "getJob", "portal"]) {
    if (html.includes(kw)) console.log("has", kw);
  }

  const endpoints = [
    `https://www1.jobdiva.com/portal/rest/job/${jobId}?a=${portalA}`,
    `https://www1.jobdiva.com/portal/api/job/${jobId}?a=${portalA}`,
    `https://www1.jobdiva.com/portal/rest/jobdetail?a=${portalA}&jobId=${jobId}`,
    `https://www1.jobdiva.com/portal/rest/job/get?a=${portalA}&id=${jobId}`,
    `https://www1.jobdiva.com/portal/rest/public/job/${jobId}?a=${portalA}`,
    `https://api.jobdiva.com/portal/rest/job/${jobId}?a=${portalA}`,
  ];
  for (const ep of endpoints) {
    const r = await fetch(ep, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
    });
    const t = await r.text();
    if (r.status !== 404) console.log(ep.split("jobdiva.com")[1], r.status, t.slice(0, 200));
  }

  const jsUrls = [...html.matchAll(/src=["']([^"']+\.js[^"']*)["']/g)].map((m) => m[1]);
  console.log("scripts", jsUrls.slice(0, 5));
}

async function probeGem() {
  const boardId = "apartment-list";
  const extId = "am9icG9zdDoimfAg9d54CIyL9evKu0-T";
  console.log("\n=== Gem ===");

  const listPayload = [
    {
      operationName: "JobBoardList",
      variables: { boardId },
      query: `query JobBoardList($boardId: String!) {
        oatsExternalJobPostings(boardId: $boardId) {
          jobPostings { id extId title }
        }
      }`,
    },
  ];

  const detailPayload = [
    {
      operationName: "ExternalJobPostingQuery",
      variables: { boardId, extId },
      query: `query ExternalJobPostingQuery($boardId: String!, $extId: String!) {
        oatsExternalJobPosting(boardId: $boardId, extId: $extId) {
          id title descriptionHtml extId
          locations { name city isoCountry isRemote }
          job { department { name } locationType employmentType }
        }
      }`,
    },
  ];

  for (const [label, payload] of [
    ["list", listPayload],
    ["detail", detailPayload],
  ] as const) {
    const r = await fetch("https://jobs.gem.com/api/public/graphql/batch", {
      method: "POST",
      headers: {
        ...FETCH_HEADERS,
        "Content-Type": "application/json",
        batch: "true",
      },
      body: JSON.stringify(payload),
    });
    console.log(label, r.status, (await r.text()).slice(0, 500));
  }

  const rest = await fetch(
    `https://api.gem.com/job_board/v0/${boardId}/job_posts/`,
    { headers: { ...FETCH_HEADERS, Accept: "application/json" } }
  );
  console.log("rest", rest.status, (await rest.text()).slice(0, 300));
}

async function probeBairesdev() {
  console.log("\n=== BairesDev ===");
  const url =
    "https://applicants.bairesdev.com/job/3/293914/apply?lang=en";
  const html = await (await fetch(url, { headers: FETCH_HEADERS })).text();
  console.log("html len", html.length);
  const $ = cheerio.load(html);
  console.log("title", $("title").text());
  if (html.includes("__NEXT_DATA__")) console.log("has __NEXT_DATA__");
  if (html.includes("application/ld+json")) console.log("has ld+json");

  const endpoints = [
    "https://applicants.bairesdev.com/api/jobs/293914",
    "https://applicants.bairesdev.com/api/job/3/293914",
    "https://applicants.bairesdev.com/api/v1/jobs/293914",
    "https://applicants.bairesdev.com/api/public/jobs/293914",
  ];
  for (const ep of endpoints) {
    const r = await fetch(ep, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
    });
    const t = await r.text();
    if (!t.startsWith("<!")) console.log(ep, r.status, t.slice(0, 300));
  }
}

async function main() {
  await probeIcims();
  await probeJobdiva();
  await probeGem();
  await probeBairesdev();
}

main();
