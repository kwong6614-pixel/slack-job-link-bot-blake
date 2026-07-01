import { scrapeJobDescription } from "../src/lib/scraper";

const urls = [
  "https://www1.jobdiva.com/portal/?a=tqjdnwtd2nqo43kj8rdgg48zv695o700479ucz7rjp0s14dmmt4cc2gvpzfoandr&jr_id=6a4477480153061b8b3e0695#/jobs/28785322",
  "https://careers-sunauto.icims.com/jobs/21676/operations-reporting-analyst/job?jr_id=6a3e8e0f78237a036d5e4560&mobile=false&width=864&height=500&bga=true&needsRedirect=false&jan1offset=-300&jun1offset=-240",
  "https://www1.jobdiva.com/portal/?a=aqjdnwo3v8u6wmvtn69zqqcruodkfg0995luxuea8829goycxm15cgr3ic7wixhv&jr_id=6a44b035b156014e414bced7#/jobs/32531182",
  "https://jobs.gem.com/apartment-list/am9icG9zdDoimfAg9d54CIyL9evKu0-T?jr_id=6a3e1786d261407de9802859",
  "https://applicants.bairesdev.com/job/3/293914/apply?utm_source=jobright&utm_medium=atsjobs&utm_campaign=jobpostingxml&jr_id=6a28986540ac8e32932a2976&lang=en",
];

async function main() {
  for (const url of urls) {
    const result = await scrapeJobDescription(url);
    console.log("\n" + "=".repeat(70));
    console.log(url.slice(0, 100));
    console.log(
      "ok:",
      !result.error,
      "structured:",
      result.structured,
      "len:",
      result.text.length
    );
    if (result.error) console.log("error:", result.error);
    if (result.text) console.log(result.text.slice(0, 300));
  }
}

main();
