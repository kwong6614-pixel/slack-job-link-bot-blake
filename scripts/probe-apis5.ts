import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function hibobPost() {
  const jobId = "25123bdc-fcf4-424c-877a-0624e213a039";
  const base = "https://reachuniversity.careers.hibob.com";
  const paths = [
    "/api/careers-site/public/job-ads/search",
    "/api/careers-site/job-ads/search",
    "/api/careers/job-ads/search",
    `/api/careers-site/public/job-ads/${jobId}`,
  ];
  const body = {
    fields: [
      "/jobAd/title",
      "/jobAd/description",
      "/jobAd/requirements",
      "/jobAd/responsibilities",
    ],
    filters: [{ fieldId: "/jobAd/id", operator: "equals", values: [jobId] }],
  };
  for (const p of paths) {
    for (const method of ["GET", "POST"] as const) {
      const r = await fetch(`${base}${p}`, {
        method,
        headers: {
          ...FETCH_HEADERS,
          Accept: "application/json",
          "Content-Type": "application/json",
          Referer: `${base}/jobs/${jobId}`,
        },
        body: method === "POST" ? JSON.stringify(body) : undefined,
      });
      const t = await r.text();
      if (!t.startsWith("<!")) {
        console.log(method, p, r.status, t.slice(0, 400));
      }
    }
  }
}

async function bullhornSettings() {
  const js = await (
    await fetch(
      "https://senecahq.com/wp-content/plugins/bullhorn-oscp/main-es2015.js",
      { headers: FETCH_HEADERS }
    )
  ).text();

  const patterns = [
    /["']([^"']*settings[^"']*\.json)["']/g,
    /fetch\(["']([^"']+)["']/g,
    /get\(["']([^"']+)["']/g,
    /APP_BASE_HREF/g,
  ];

  for (const p of patterns) {
    const matches = [...js.matchAll(p)].map((m) => m[1]).filter(Boolean);
    const unique = [...new Set(matches)].filter(
      (s) => typeof s === "string" && s.length < 100
    );
    if (unique.length) console.log("\npattern", p, unique.slice(0, 20));
  }

  // Try common bullhorn settings paths from career-portal repo
  const paths = [
    "app-settings.json",
    "assets/app-settings.json",
    "static/app-settings.json",
    "data/app-settings.json",
    "environments/environment.json",
    "assets/environment.json",
  ];
  for (const p of paths) {
    const u = `https://senecahq.com/wp-content/plugins/bullhorn-oscp/${p}`;
    const r = await fetch(u, { headers: FETCH_HEADERS });
    if (r.status === 200) {
      const t = await r.text();
      if (t.startsWith("{")) console.log("FOUND", u, t.slice(0, 300));
    }
  }
}

async function ultiproBriefLen() {
  const company = "HOR1005";
  const boardId = "1e0e1ed9-90e0-3f93-f7ee-8b0a223db196";
  const oppId = "e8da4840-d473-41ac-be90-7f39e1dd5bb8";
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
  const r = await fetch(
    `https://recruiting.ultipro.com/${company}/JobBoard/${boardId}/JobBoardView/LoadSearchResults`,
    {
      method: "POST",
      headers: {
        ...FETCH_HEADERS,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await r.json();
  const job = data.opportunities.find((o: { Id: string }) => o.Id === oppId);
  console.log("brief len", job?.BriefDescription?.length);
  console.log("brief", job?.BriefDescription);
}

async function main() {
  await hibobPost();
  await bullhornSettings();
  await ultiproBriefLen();
}

main();
