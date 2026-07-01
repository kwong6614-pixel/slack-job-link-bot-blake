import { scrapeJobDescription } from "../src/lib/scraper";

const urls = [
  "https://senecahq.com/wp-content/plugins/bullhorn-oscp/#/jobs/47322",
  "https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=779e6012-26df-4c72-b6e4-b191845f9776&ccId=19000101_000001&lang=en_US&jobId=552097&source=LI&jr_id=6a451be42dfd1f741d104b8a",
  "https://careers.publicisgroupe.com/jobs/155532?jr_id=6a43d2f057ffc22029403c11",
  "https://reachuniversity.careers.hibob.com/jobs/25123bdc-fcf4-424c-877a-0624e213a039?jr_id=6a441271ef17a815538a2d4a",
  "https://recruiting.ultipro.com/HOR1005/JobBoard/1e0e1ed9-90e0-3f93-f7ee-8b0a223db196/OpportunityDetail?opportunityId=e8da4840-d473-41ac-be90-7f39e1dd5bb8&source=jobright&jr_id=6a4404c9b156014e414bb1a6",
];

async function main() {
  for (const url of urls) {
    const result = await scrapeJobDescription(url);
    console.log("\n" + "=".repeat(70));
    console.log(url.slice(0, 90));
    console.log(
      "ok:",
      !result.error,
      "structured:",
      result.structured,
      "partial:",
      result.partial,
      "len:",
      result.text.length
    );
    if (result.error) console.log("error:", result.error);
    if (result.text) console.log(result.text.slice(0, 250));
  }
}

main();
