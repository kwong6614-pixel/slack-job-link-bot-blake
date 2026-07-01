import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function main() {
  // ADP full fields
  const cid = "779e6012-26df-4c72-b6e4-b191845f9776";
  const jobId = "552097";
  const adp = await fetch(
    `https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/${jobId}?cid=${cid}&lang=en_US&locale=en_US`,
    { headers: { ...FETCH_HEADERS, Accept: "application/json" } }
  );
  const adpData = await adp.json();
  console.log("ADP keys:", Object.keys(adpData));
  console.log("title:", adpData.requisitionTitle);
  console.log(
    "desc len:",
    String(adpData.requisitionDescription || "").length
  );

  // Bullhorn - look for settings in HTML
  const bhHtml = await (
    await fetch("https://senecahq.com/wp-content/plugins/bullhorn-oscp/", {
      headers: FETCH_HEADERS,
    })
  ).text();
  const settingsMatch = bhHtml.match(/settings\s*[:=]\s*(\{[\s\S]{0,2000}?\})/);
  console.log("\nBullhorn settings match:", settingsMatch?.[1]?.slice(0, 300));
  // check for inline config
  for (const pat of [/corpToken["']?\s*[:=]\s*["']([^"']+)/i, /swimlane["']?\s*[:=]\s*["']([^"']+)/i]) {
    const m = bhHtml.match(pat);
    if (m) console.log("inline", m[0]);
  }

  // HiBob - scan main js for api path
  const hibobMain = await (
    await fetch(
      "https://front.hibob.com/master-38ee4e6f5781650183ec71fb1f969885fa8b658d/careers/main.0d04c1d89823857b.js",
      { headers: FETCH_HEADERS }
    )
  ).text();
  const apiMatches = [...hibobMain.matchAll(/["']([^"']*\/api[^"']*)["']/g)].slice(0, 20);
  console.log("\nHiBob api strings:", [...new Set(apiMatches.map((m) => m[1]))].slice(0, 15));

  // UltiPro - search HTML for description or API
  const oppId = "e8da4840-d473-41ac-be90-7f39e1dd5bb8";
  const boardId = "1e0e1ed9-90e0-3f93-f7ee-8b0a223db196";
  const ultHtml = await (
    await fetch(
      `https://recruiting.ultipro.com/HOR1005/JobBoard/${boardId}/OpportunityDetail?opportunityId=${oppId}`,
      { headers: FETCH_HEADERS }
    )
  ).text();
  const $ = cheerio.load(ultHtml);
  for (const sel of [
    ".job-description",
    ".description",
    "[class*='description']",
    "[data-bind*='description']",
    "script",
  ]) {
    const els = $(sel);
    if (sel === "script") {
      for (const el of els.toArray().slice(0, 5)) {
        const t = $(el).html() || "";
        if (t.includes("opportunity") || t.includes("Description")) {
          console.log("\nUltiPro script snippet:", t.slice(0, 300));
        }
      }
    } else if (els.length) {
      console.log("\nUltiPro", sel, "count", els.length, "text", els.first().text().slice(0, 200));
    }
  }
  if (ultHtml.includes("LoadOpportunityDetail")) console.log("has LoadOpportunityDetail");
  const apiPaths = [...ultHtml.matchAll(/\/JobBoard\/[^"']+/g)].slice(0, 10);
  console.log("UltiPro paths:", [...new Set(apiPaths.map((m) => m[0]))]);

  // UltiPro LoadSearchResults
  const loadUrl = `https://recruiting.ultipro.com/HOR1005/JobBoard/${boardId}/JobBoardView/LoadSearchResults`;
  const loadResp = await fetch(loadUrl, {
    method: "POST",
    headers: {
      ...FETCH_HEADERS,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({
      opportunityId: oppId,
      searchFilters: [],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const loadText = await loadResp.text();
  console.log("\nLoadSearchResults status", loadResp.status, loadText.slice(0, 600));
}

main();
