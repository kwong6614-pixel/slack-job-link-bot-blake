import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";
import { scrapeJobDescription } from "../src/lib/scraper";

async function deep(url: string) {
  const r = await fetch(url, {
    headers: FETCH_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const html = await r.text();
  console.log("\n===", url.slice(0, 90));

  const $ = cheerio.load(html);
  const scripts = $("script[src]")
    .map((_, e) => $(e).attr("src"))
    .get()
    .slice(0, 10);
  if (scripts.length) console.log("scripts:", scripts);

  for (const kw of [
    "api.",
    "/api/",
    "jobId",
    "opportunityId",
    "__NEXT_DATA__",
    "corpToken",
    "swimlane",
    "public-rest",
    "rest-services",
    "hibob",
    "ultipro",
    "ukg",
  ]) {
    if (html.toLowerCase().includes(kw.toLowerCase())) console.log("has:", kw);
  }

  const ld = $('script[type="application/ld+json"]').first().html();
  if (ld) console.log("ld+json sample:", ld.slice(0, 200));

  console.log("body text len:", $("body").text().replace(/\s+/g, " ").trim().length);
}

async function main() {
  const urls = [
    "https://senecahq.com/wp-content/plugins/bullhorn-oscp/",
    "https://reachuniversity.careers.hibob.com/jobs/25123bdc-fcf4-424c-877a-0624e213a039",
    "https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=779e6012-26df-4c72-b6e4-b191845f9776&jobId=552097",
    "https://recruiting.ultipro.com/HOR1005/JobBoard/1e0e1ed9-90e0-3f93-f7ee-8b0a223db196/OpportunityDetail?opportunityId=e8da4840-d473-41ac-be90-7f39e1dd5bb8",
    "https://careers.publicisgroupe.com/jobs/155532",
  ];

  for (const u of urls) await deep(u);

  console.log("\n\n=== SCRAPE TESTS ===");
  for (const u of urls) {
    const r = await scrapeJobDescription(u);
    console.log("\n---", u.slice(0, 70));
    console.log(
      "error:",
      r.error,
      "structured:",
      r.structured,
      "len:",
      r.text.length
    );
    if (r.text) console.log(r.text.slice(0, 250));
  }
}

main();
