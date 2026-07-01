import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function parseUltiproHtml() {
  const oppId = "e8da4840-d473-41ac-be90-7f39e1dd5bb8";
  const boardId = "1e0e1ed9-90e0-3f93-f7ee-8b0a223db196";
  const html = await (
    await fetch(
      `https://recruiting.ultipro.com/HOR1005/JobBoard/${boardId}/OpportunityDetail?opportunityId=${oppId}`,
      { headers: FETCH_HEADERS }
    )
  ).text();

  const descIdx = html.toLowerCase().indexOf("description");
  console.log("description occurrences", (html.match(/description/gi) || []).length);
  if (descIdx >= 0) {
    console.log("first desc ctx", html.slice(descIdx - 100, descIdx + 300));
  }

  const jsonMatches = html.match(/\{[^{}]{100,500}Description[^{}]{100,500}\}/g);
  console.log("json-like", jsonMatches?.slice(0, 2));

  // Try OpportunityApply or other endpoints
  const endpoints = [
    `OpportunityApply/Load?opportunityId=${oppId}`,
    `OpportunityDetail/Index?opportunityId=${oppId}`,
    `JobBoardView/LoadOpportunity?opportunityId=${oppId}`,
    `JobBoardView/GetOpportunity?opportunityId=${oppId}`,
  ];
  for (const ep of endpoints) {
    const url = `https://recruiting.ultipro.com/HOR1005/JobBoard/${boardId}/${ep}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        ...FETCH_HEADERS,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ opportunityId: oppId }),
    });
    const t = await r.text();
    if (r.status !== 404) {
      console.log("\n", ep, r.status, t.slice(0, 500));
    }
  }
}

async function hibobHeaders() {
  const jobId = "25123bdc-fcf4-424c-877a-0624e213a039";
  const paths = [
    `/api/careers/job-ads/${jobId}`,
    `/api/careers-site/job-ads/${jobId}`,
    `/api/careers-site/public/job-ads/${jobId}`,
    `/api/public/careers/job-ads/${jobId}`,
  ];
  const headerSets = [
    {},
    { Accept: "application/json" },
    { Accept: "application/json", "X-Company-Name": "reachuniversity" },
    { Accept: "application/json", Origin: "https://reachuniversity.careers.hibob.com" },
    {
      Accept: "application/json",
      Referer: `https://reachuniversity.careers.hibob.com/jobs/${jobId}`,
    },
  ];
  for (const path of paths) {
    for (const extra of headerSets) {
      const r = await fetch(`https://reachuniversity.careers.hibob.com${path}`, {
        headers: { ...FETCH_HEADERS, ...extra },
      });
      if (r.status !== 404) {
        console.log(path, extra, r.status, (await r.text()).slice(0, 120));
      }
    }
  }
}

async function bullhornPages() {
  const pages = [
    "https://senecahq.com/jobs/",
    "https://senecahq.com/career-portal/",
    "https://senecahq.com/open-positions/",
    "https://senecahq.com/wp-content/plugins/bullhorn-oscp/assets/app.settings.json",
    "https://senecahq.com/wp-content/plugins/bullhorn-oscp/app.settings.json",
  ];
  for (const u of pages) {
    const r = await fetch(u, { headers: FETCH_HEADERS, redirect: "follow" });
    const t = await r.text();
    console.log(u, r.status, t.length, t.includes("corpToken"), t.includes("swimlane"));
    if (t.includes("corpToken")) {
      const m = t.match(/corpToken["']?\s*[:=]\s*["']([^"']+)/);
      console.log("  token", m?.[1]);
    }
  }
}

async function main() {
  await parseUltiproHtml();
  await hibobHeaders();
  await bullhornPages();
}

main();
