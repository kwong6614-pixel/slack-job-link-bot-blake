import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function bullhorn() {
  const js = await (
    await fetch(
      "https://senecahq.com/wp-content/plugins/bullhorn-oscp/main-es2015.js",
      { headers: FETCH_HEADERS }
    )
  ).text();

  const settingsPaths = [
    ...new Set(
      [...js.matchAll(/["']([^"']*(?:settings|config)[^"']*)["']/g)]
        .map((m) => m[1])
        .filter((s) => s.length < 80 && !s.includes(" "))
    ),
  ];
  console.log("settings paths", settingsPaths.slice(0, 30));

  const entityIdx = js.indexOf("entity/JobOrder");
  if (entityIdx >= 0) {
    console.log("entity ctx", js.slice(entityIdx - 60, entityIdx + 200));
  }

  const candidates = [
    "assets/app.settings.json",
    "app.settings.json",
    "assets/settings.json",
    "static/app.settings.json",
  ];
  for (const p of candidates) {
    const u = `https://senecahq.com/wp-content/plugins/bullhorn-oscp/${p}`;
    const r = await fetch(u, { headers: FETCH_HEADERS });
    if (r.status === 200) {
      const t = await r.text();
      console.log("FOUND", p, t.slice(0, 400));
    }
  }
}

async function hibob() {
  const jobId = "25123bdc-fcf4-424c-877a-0624e213a039";
  const base = "https://reachuniversity.careers.hibob.com";
  const paths = [
    `/api/careers-site/public/job-ads/${jobId}`,
    `/api/careers-site/public/job-ads/${jobId}/details`,
    `/api/careers-site/job-ads/${jobId}`,
  ];

  for (const path of paths) {
    for (const method of ["GET", "POST"] as const) {
      const r = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...FETCH_HEADERS,
          Accept: "application/json",
          "Content-Type": "application/json",
          Referer: `${base}/jobs/${jobId}`,
        },
        body: method === "POST" ? JSON.stringify({}) : undefined,
      });
      const t = await r.text();
      if (!t.startsWith("<!")) {
        console.log(method, path, r.status, t.slice(0, 300));
      }
    }
  }
}

async function ultiproFull() {
  const company = "HOR1005";
  const boardId = "1e0e1ed9-90e0-3f93-f7ee-8b0a223db196";
  const oppId = "e8da4840-d473-41ac-be90-7f39e1dd5bb8";

  const endpoints = [
    `OpportunityDetail/LoadDescription`,
    `OpportunityDetail/GetDescription`,
    `OpportunityDetail/LoadJobDescription`,
    `OpportunityDetail/LoadOpportunityDescription`,
  ];
  for (const ep of endpoints) {
    const url = `https://recruiting.ultipro.com/${company}/JobBoard/${boardId}/${ep}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        ...FETCH_HEADERS,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ opportunityId: oppId }),
    });
    if (r.status !== 404) {
      console.log(ep, r.status, (await r.text()).slice(0, 400));
    }
  }
}

async function main() {
  await bullhorn();
  await hibob();
  await ultiproFull();
}

main();
