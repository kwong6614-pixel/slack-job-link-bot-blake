import { writeFileSync } from "fs";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function main() {
  const portalA =
    "tqjdnwtd2nqo43kj8rdgg48zv695o700479ucz7rjp0s14dmmt4cc2gvpzfoandr";
  const html = await (
    await fetch(`https://www1.jobdiva.com/portal/?a=${portalA}`, {
      headers: FETCH_HEADERS,
    })
  ).text();
  writeFileSync("scripts/jobdiva-portal.html", html);
  console.log("len", html.length);

  for (const term of [
    "static",
    "chunk",
    "bundle",
    "webpack",
    "loadScript",
    "createElement",
    "rest/",
    "openJob",
    "getJob",
    "28785322",
  ]) {
    let idx = 0;
    let count = 0;
    while ((idx = html.indexOf(term, idx)) >= 0 && count < 3) {
      console.log(term, html.slice(Math.max(0, idx - 30), idx + 80).replace(/\s+/g, " "));
      idx++;
      count++;
    }
  }
}

main();
