import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

const UA = FETCH_HEADERS["User-Agent"];

async function probe(url: string) {
  console.log("\n===", url.slice(0, 80), "...");
  try {
    const r = await fetch(url, {
      headers: { ...FETCH_HEADERS },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const html = await r.text();
    const $ = cheerio.load(html);
    const ld = $('script[type="application/ld+json"]').length;
    const title = $("title").text().trim().slice(0, 100);
    const og = $('meta[property="og:description"]').attr("content")?.slice(0, 100);
    const bodyLen = $("body").text().replace(/\s+/g, " ").trim().length;
    console.log("status", r.status, "final", r.url.slice(0, 90));
    console.log("ld+json", ld, "body", bodyLen, "title:", title);
    if (og) console.log("og:", og);
    if (html.includes("__NEXT_DATA__")) console.log("has __NEXT_DATA__");
    if (html.includes("JobPosting")) console.log("mentions JobPosting");
  } catch (e) {
    console.log("ERR", (e as Error).message);
  }
}

async function main() {
  const urls = [
    "https://senecahq.com/wp-content/plugins/bullhorn-oscp/",
    "https://careers.publicisgroupe.com/jobs/155532",
    "https://reachuniversity.careers.hibob.com/jobs/25123bdc-fcf4-424c-877a-0624e213a039",
    "https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=779e6012-26df-4c72-b6e4-b191845f9776&ccId=19000101_000001&lang=en_US&jobId=552097",
    "https://recruiting.ultipro.com/HOR1005/JobBoard/1e0e1ed9-90e0-3f93-f7ee-8b0a223db196/OpportunityDetail?opportunityId=e8da4840-d473-41ac-be90-7f39e1dd5bb8",
  ];
  for (const u of urls) await probe(u);
}

main();
