import { writeFileSync } from "fs";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function main() {
  const js = await (
    await fetch(
      "https://rec-cdn-prod.cdn.ultipro.com/rec-web/4c6c68ccb8a16aa1c08f121eb7629bc6c290bd6e/site.min.js",
      { headers: FETCH_HEADERS }
    )
  ).text();
  writeFileSync("scripts/ultipro-site.min.js", js);
  console.log("saved", js.length);

  for (const term of [
    "OpportunityDetail",
    "LoadOpportunity",
    "FullDescription",
    "BriefDescription",
    "JobDescription",
    "LoadJob",
  ]) {
    const re = new RegExp(`.{0,40}${term}.{0,60}`, "g");
    const matches = js.match(re);
    console.log("\n", term, matches?.slice(0, 8));
  }

  const bh = await (
    await fetch(
      "https://senecahq.com/wp-content/plugins/bullhorn-oscp/main-es2015.js",
      { headers: FETCH_HEADERS }
    )
  ).text();
  for (const term of ["settings", "APP_CONFIG", ".json", "localStorage"]) {
    const re = new RegExp(`.{0,50}${term}.{0,80}`, "g");
    console.log("\nBH", term, bh.match(re)?.slice(0, 5));
  }

  const hb = await (
    await fetch(
      "https://front.hibob.com/master-38ee4e6f5781650183ec71fb1f969885fa8b658d/careers/main.0d04c1d89823857b.js",
      { headers: FETCH_HEADERS }
    )
  ).text();
  writeFileSync("scripts/hibob-careers-main.js", hb);
  const hbMatches = [...hb.matchAll(/["'](\/[^"']*job[^"']*)["']/gi)].map((m) => m[1]);
  console.log("\nHiBob job paths", [...new Set(hbMatches)].slice(0, 30));
}

main();
