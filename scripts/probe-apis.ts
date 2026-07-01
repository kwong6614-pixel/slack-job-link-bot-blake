import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function tryJson(label: string, url: string, init?: RequestInit) {
  try {
    const r = await fetch(url, {
      ...init,
      headers: { ...FETCH_HEADERS, Accept: "application/json", ...(init?.headers || {}) },
      signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    console.log(`\n${label}`);
    console.log("status", r.status, "ct", r.headers.get("content-type"));
    console.log(text.slice(0, 500));
  } catch (e) {
    console.log(label, "ERR", (e as Error).message);
  }
}

async function main() {
  const cid = "779e6012-26df-4c72-b6e4-b191845f9776";
  const jobId = "552097";
  await tryJson(
    "ADP detail",
    `https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/${jobId}?cid=${cid}&lang=en_US&locale=en_US`
  );

  const oppId = "e8da4840-d473-41ac-be90-7f39e1dd5bb8";
  const boardId = "1e0e1ed9-90e0-3f93-f7ee-8b0a223db196";
  await tryJson(
    "UltiPro opportunity",
    `https://recruiting.ultipro.com/HOR1005/JobBoard/${boardId}/OpportunityDetail?opportunityId=${oppId}&format=json`
  );
  await tryJson(
    "UltiPro LoadOpportunity",
    `https://recruiting.ultipro.com/HOR1005/JobBoard/${boardId}/OpportunityDetail/Load?opportunityId=${oppId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ opportunityId: oppId }),
    }
  );

  const hibobId = "25123bdc-fcf4-424c-877a-0624e213a039";
  await tryJson(
    "HiBob public",
    `https://reachuniversity.careers.hibob.com/api/job-ad/${hibobId}`
  );
  await tryJson(
    "HiBob api v1",
    `https://reachuniversity.careers.hibob.com/api/v1/job-ads/${hibobId}`
  );
  await tryJson(
    "HiBob front api",
    `https://front.hibob.com/careers/api/job-ad/${hibobId}`
  );

  const r = await fetch(
    "https://senecahq.com/wp-content/plugins/bullhorn-oscp/main-es2015.js",
    { headers: FETCH_HEADERS }
  );
  const js = await r.text();
  for (const p of ["corpToken", "swimlane", "public-rest", "rest-services", "JobOrder"]) {
    const i = js.indexOf(p);
    if (i >= 0) console.log("\nBullhorn", p, js.slice(i, i + 150));
  }
}

main();
