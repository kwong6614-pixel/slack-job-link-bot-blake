import { parseSmartRecruitersUrl } from "../src/lib/smartrecruiters";
import { scrapeJobDescription } from "../src/lib/scraper";

const url =
  "https://jobs.smartrecruiters.com/oneclick-ui/company/ParallelPartners1/publication/3547f550-623d-46d4-95f0-94b5a63d3be2?dcr_ci=ParallelPartners1&jr_id=6a465f230dd56c76cc2f9037";

async function main() {
  console.log("parsed", parseSmartRecruitersUrl(url));
  const result = await scrapeJobDescription(url);
  console.log("ok:", !result.error, "structured:", result.structured, "len:", result.text.length);
  if (result.error) console.log("error:", result.error);
  if (result.text) console.log(result.text.slice(0, 500));
}

main();
