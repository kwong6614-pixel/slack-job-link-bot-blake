import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function jobdiva() {
  const portalA =
    "tqjdnwtd2nqo43kj8rdgg48zv695o700479ucz7rjp0s14dmmt4cc2gvpzfoandr";
  const jobId = "28785322";
  const html = await (
    await fetch(`https://www1.jobdiva.com/portal/?a=${portalA}`, {
      headers: FETCH_HEADERS,
    })
  ).text();

  const scripts = [...html.matchAll(/src=["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((s) => s.includes(".js") && !s.includes("recaptcha"));
  console.log("scripts", scripts);

  for (const script of scripts.slice(0, 8)) {
    const url = script.startsWith("http")
      ? script
      : `https://www1.jobdiva.com${script.startsWith("/") ? "" : "/portal/"}${script}`;
    try {
      const js = await (await fetch(url, { headers: FETCH_HEADERS })).text();
      for (const term of ["getJob", "jobdetail", "JobDetail", "/rest/", "28785322"]) {
        if (js.includes(term)) {
          const i = js.indexOf(term);
          console.log("\n", url.split("/").pop(), term, js.slice(Math.max(0, i - 40), i + 120));
        }
      }
    } catch {
      /* skip */
    }
  }

  const tries = [
    `https://www1.jobdiva.com/portal/rest/job/${jobId}?a=${portalA}`,
    `https://www2.jobdiva.com/portal/rest/job/${jobId}?a=${portalA}`,
    `https://api.jobdiva.com/portal/rest/job/${jobId}?a=${portalA}`,
  ];
  for (const u of tries) {
    for (const accept of ["application/json", "*/*", "text/html"]) {
      const r = await fetch(u, {
        headers: { ...FETCH_HEADERS, Accept: accept, Referer: `https://www1.jobdiva.com/portal/?a=${portalA}` },
      });
      const t = await r.text();
      console.log("\n", u.split(".com")[1], accept, r.status, t.slice(0, 150));
    }
  }
}

async function bairesdev() {
  const html = await (
    await fetch("https://applicants.bairesdev.com/job/3/293914/apply?lang=en", {
      headers: FETCH_HEADERS,
    })
  ).text();
  console.log("\n=== BairesDev HTML hints ===");
  for (const term of ["api", "bridge", "293914", "jobDescription", "description", "__NUXT", "__NEXT"]) {
    if (html.includes(term)) console.log("has", term);
  }

  const scripts = [...html.matchAll(/src=["']([^"']+\.js[^"']*)["']/g)].map((m) => m[1]);
  console.log("scripts", scripts.slice(0, 8));

  const endpoints = [
    "https://applicants.bairesdev.com/api/bridge/3/jobs/293914",
    "https://applicants.bairesdev.com/api/bridges/3/jobs/293914",
    "https://applicants.bairesdev.com/api/bridge/3/job/293914",
    "https://applicants.bairesdev.com/api/bridge/3/positions/293914",
    "https://applicants.bairesdev.com/api/bridge/3/vacancies/293914",
    "https://applicants.bairesdev.com/api/bridge/3/public/jobs/293914",
    "https://applicants.bairesdev.com/api/public/bridge/3/jobs/293914",
    "https://applicants.bairesdev.com/api/public/job/3/293914",
  ];
  for (const ep of endpoints) {
    const r = await fetch(ep, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
    });
    const t = await r.text();
    if (!t.includes("Bridge not found") && !t.startsWith("<!")) {
      console.log(ep, r.status, t.slice(0, 400));
    }
  }
}

async function icims() {
  console.log("\n=== iCIMS alt URLs ===");
  const urls = [
    "https://careers-sunauto.icims.com/jobs/21676/operations-reporting-analyst/job?mode=job&iis=Job+Board&iisn=LinkedIn&mobile=yes&width=864&height=500",
    "https://careers-sunauto.icims.com/jobs/21676/job",
    "https://careers-sunauto.icims.com/jobs/21676/operations-reporting-analyst/job?mobile=yes&width=864&height=500",
    "https://careers-sunauto.icims.com/jobs/21676/operations-reporting-analyst.json",
    "https://careers-sunauto.icims.com/jobs/21676/operations-reporting-analyst/job?in_iframe=1&mobile=yes",
  ];
  for (const url of urls) {
    const r = await fetch(url, {
      headers: {
        ...FETCH_HEADERS,
        Referer: "https://careers-sunauto.icims.com/",
      },
    });
    const t = await r.text();
    const title = cheerio.load(t)("title").text();
    console.log(r.status, title.slice(0, 40), "len", t.length);
    if (t.includes("JobPosting")) console.log("  has JobPosting");
  }
}

async function main() {
  await jobdiva();
  await bairesdev();
  await icims();
}

main();
