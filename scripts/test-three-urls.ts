import { scrapeJobDescription } from "../src/lib/scraper";

const urls = [
  "https://jobs.gusto.com/postings/toro-backend-developer-8f2d5640-8006-40e7-a966-b4342c87c85e?jr_id=6a44cbd0bc200d552870fde6",
  "https://careers-sunauto.icims.com/jobs/21676/operations-reporting-analyst/job?jr_id=6a3e8e0f78237a036d5e4560&mobile=false&width=864&height=500&bga=true&needsRedirect=false&jan1offset=-300&jun1offset=-240",
  "https://app.dover.com/apply/TruTechnologies/099f8ad4-ed41-45db-9753-b59adec16e7a?jr_id=6a442667ef17a815538a328b",
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
    if (result.text) console.log(result.text.slice(0, 400));
  }
}

main();
