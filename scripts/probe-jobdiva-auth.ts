import { readFileSync } from "fs";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

const js = readFileSync("scripts/jobdiva-bundle.js", "utf8");

for (const term of [
  "getAllJobs=function",
  "getJobs=function",
  "Authorization",
  "portalToken",
  'getUrlParam("a"',
  "/job/get",
  "interceptor",
  "Bearer",
]) {
  let idx = 0;
  let count = 0;
  while ((idx = js.indexOf(term, idx)) >= 0 && count < 2) {
    console.log("\n", term, js.slice(idx, idx + 400).replace(/\s+/g, " "));
    idx++;
    count++;
  }
}

async function testJobsList() {
  const portalA =
    "tqjdnwtd2nqo43kj8rdgg48zv695o700479ucz7rjp0s14dmmt4cc2gvpzfoandr";
  const base = "https://ws.jobdiva.com/candPortal/rest/";
  const endpoints = [
    `job/getalljobs?compid=0&a=${portalA}`,
    `job/getalljobs?compid=71&a=${portalA}`,
    `job/getjobs?compid=0&a=${portalA}`,
    `job/searchjobs?compid=0&a=${portalA}`,
    `portal/getjobs?a=${portalA}`,
    `portal/job/getalljobs?a=${portalA}`,
  ];
  for (const ep of endpoints) {
    const r = await fetch(base + ep, {
      headers: {
        ...FETCH_HEADERS,
        Accept: "application/json",
        Referer: "https://www1.jobdiva.com/portal/",
      },
    });
    const t = await r.text();
    if (r.status !== 404) console.log("\n", ep, r.status, t.slice(0, 200));
  }
}

testJobsList();
