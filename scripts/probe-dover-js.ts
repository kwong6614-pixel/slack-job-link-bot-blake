import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function main() {
  const jobId = "099f8ad4-ed41-45db-9753-b59adec16e7a";
  const html = await (
    await fetch(`https://app.dover.com/apply/TruTechnologies/${jobId}`, {
      headers: FETCH_HEADERS,
    })
  ).text();

  const scripts = [...html.matchAll(/src=["']([^"']+\.js[^"']*)["']/g)].map((m) => m[1]);
  console.log("scripts", scripts.slice(0, 10));

  for (const term of [
    "job_posting",
    "jobPosting",
    "099f8ad4",
    "description",
    "api/v1",
    "public/job",
    "__PRELOADED",
    "window.__",
  ]) {
    let i = 0,
      c = 0;
    while ((i = html.indexOf(term, i)) >= 0 && c < 2) {
      console.log("\n", term, html.slice(Math.max(0, i - 40), i + 120).replace(/\s+/g, " "));
      i++;
      c++;
    }
  }

  // fetch main js bundle
  const mainScript = scripts.find((s) => s.includes("main") || s.includes("index"));
  if (mainScript) {
    const jsUrl = mainScript.startsWith("http")
      ? mainScript
      : `https://app.dover.com${mainScript.startsWith("/") ? "" : "/"}${mainScript}`;
    console.log("\nFetching", jsUrl);
    const js = await (await fetch(jsUrl, { headers: FETCH_HEADERS })).text();
    for (const term of ["job_postings", "public/job", "careers/", "JobPosting"]) {
      let i = 0,
        c = 0;
      while ((i = js.indexOf(term, i)) >= 0 && c < 2) {
        console.log("\nJS", term, js.slice(i, i + 150));
        i++;
        c++;
      }
    }
  }
}

main();
