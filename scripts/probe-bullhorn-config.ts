import { writeFileSync } from "fs";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function main() {
  const js = await (
    await fetch(
      "https://senecahq.com/wp-content/plugins/bullhorn-oscp/main-es2015.js",
      { headers: FETCH_HEADERS }
    )
  ).text();
  writeFileSync("scripts/bullhorn-main.js", js);

  let idx = 0;
  while ((idx = js.indexOf("app-config", idx)) >= 0) {
    console.log(js.slice(Math.max(0, idx - 80), idx + 120).replace(/\s+/g, " "));
    idx++;
  }

  idx = 0;
  while ((idx = js.indexOf("getJob", idx)) >= 0 && idx < 500000) {
    const slice = js.slice(idx, idx + 80);
    if (slice.includes("JobOrder") || slice.includes("job")) {
      console.log("getJob", slice);
    }
    idx++;
  }
}

main();
