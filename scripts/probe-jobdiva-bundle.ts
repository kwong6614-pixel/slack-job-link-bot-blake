import { gunzipSync } from "zlib";
import { writeFileSync } from "fs";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function main() {
  const url =
    "https://www1.jobdiva.com/portal/index_bundle.js.gz?v=20260630_02";
  const buf = Buffer.from(await (await fetch(url, { headers: FETCH_HEADERS })).arrayBuffer());
  const js = gunzipSync(buf).toString("utf8");
  writeFileSync("scripts/jobdiva-bundle.js", js);
  console.log("bundle len", js.length);

  for (const term of [
    "getJob",
    "JobDetail",
    "jobdetail",
    "/rest/",
    "openJobs",
    "searchJobs",
    "28785322",
    "publicDescription",
    "jobDescription",
  ]) {
    let idx = 0;
    let count = 0;
    while ((idx = js.indexOf(term, idx)) >= 0 && count < 4) {
      console.log("\n", term, js.slice(Math.max(0, idx - 50), idx + 120).replace(/\s+/g, " "));
      idx++;
      count++;
    }
  }
}

main();
