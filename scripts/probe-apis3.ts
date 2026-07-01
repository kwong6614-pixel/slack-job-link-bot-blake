import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function ultiproSearch() {
  const company = "HOR1005";
  const boardId = "1e0e1ed9-90e0-3f93-f7ee-8b0a223db196";
  const oppId = "e8da4840-d473-41ac-be90-7f39e1dd5bb8";
  const apiUrl = `https://recruiting.ultipro.com/${company}/JobBoard/${boardId}/JobBoardView/LoadSearchResults`;

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

  const r = await fetch(apiUrl, {
    method: "POST",
    headers: {
      ...FETCH_HEADERS,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  console.log("totalCount", data.totalCount);
  const match = (data.opportunities || []).find(
    (o: { Id?: string }) => o.Id === oppId
  );
  console.log("match found", !!match);
  if (match) {
    console.log("title", match.Title);
    console.log("brief", String(match.BriefDescription || "").slice(0, 300));
    console.log("keys", Object.keys(match));
  }

  // Try opportunity detail endpoint variants
  const endpoints = [
    `https://recruiting.ultipro.com/${company}/JobBoard/${boardId}/OpportunityDetail/Load?opportunityId=${oppId}`,
    `https://recruiting.ultipro.com/${company}/JobBoard/${boardId}/OpportunityDetail/Get?opportunityId=${oppId}`,
    `https://recruiting.ultipro.com/${company}/JobBoard/${boardId}/OpportunityDetail/LoadOpportunityDetail`,
  ];
  for (const ep of endpoints) {
    const resp = await fetch(ep, {
      method: "POST",
      headers: {
        ...FETCH_HEADERS,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ opportunityId: oppId }),
    });
    const t = await resp.text();
    console.log("\n", ep.split("/").slice(-2).join("/"), resp.status, t.slice(0, 400));
  }
}

async function bullhornConfig() {
  const html = await (
    await fetch("https://senecahq.com/wp-content/plugins/bullhorn-oscp/", {
      headers: FETCH_HEADERS,
    })
  ).text();
  console.log("\nBullhorn HTML len", html.length);
  const $ = cheerio.load(html);
  $("script:not([src])").each((_, el) => {
    const t = $(el).html() || "";
    if (t.includes("corpToken") || t.includes("settings")) {
      console.log("inline script:", t.slice(0, 500));
    }
  });
  // search main js for default settings
  const js = await (
    await fetch(
      "https://senecahq.com/wp-content/plugins/bullhorn-oscp/main-es2015.js",
      { headers: FETCH_HEADERS }
    )
  ).text();
  const idx = js.indexOf("defaultSettings");
  if (idx >= 0) console.log("defaultSettings", js.slice(idx, idx + 400));
  const idx2 = js.indexOf("corpToken:");
  if (idx2 >= 0) console.log("corpToken literal", js.slice(idx2 - 50, idx2 + 200));
}

async function hibobApi() {
  const jobId = "25123bdc-fcf4-424c-877a-0624e213a039";
  const main = await (
    await fetch(
      "https://front.hibob.com/master-38ee4e6f5781650183ec71fb1f969885fa8b658d/careers/main.0d04c1d89823857b.js",
      { headers: FETCH_HEADERS }
    )
  ).text();
  for (const term of ["job-ad", "jobAd", "job-ads", "hiring", "careers/api", "public"]) {
    const i = main.indexOf(term);
    if (i >= 0) console.log("\nHiBob", term, main.slice(Math.max(0, i - 40), i + 120));
  }

  const candidates = [
    `https://reachuniversity.careers.hibob.com/api/careers/job-ad/${jobId}`,
    `https://reachuniversity.careers.hibob.com/api/careers/job-ads/${jobId}`,
    `https://reachuniversity.careers.hibob.com/api/public/job-ad/${jobId}`,
    `https://reachuniversity.careers.hibob.com/api/public/job-ads/${jobId}`,
    `https://reachuniversity.careers.hibob.com/api/hiring/job-ads/${jobId}`,
  ];
  for (const u of candidates) {
    const r = await fetch(u, { headers: { ...FETCH_HEADERS, Accept: "application/json" } });
    console.log(u, r.status, (await r.text()).slice(0, 150));
  }
}

async function main() {
  await ultiproSearch();
  await bullhornConfig();
  await hibobApi();
}

main();
