import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function probeDover() {
  const jobId = "099f8ad4-ed41-45db-9753-b59adec16e7a";
  const company = "TruTechnologies";

  const js = await (
    await fetch(
      "https://app.dover.com/static/search-builder2/static/js/index-CcCBNeEI.js",
      { headers: FETCH_HEADERS }
    )
  ).text();

  const apiPaths = [
    ...new Set(
      [...js.matchAll(/["'](\/api\/v1[^"']+)["']/g)].map((m) => m[1])
    ),
  ].slice(0, 30);
  console.log("Dover API paths in JS:", apiPaths);

  const endpoints = [
    `https://app.dover.com/api/v1/external/public/job_postings/${jobId}`,
    `https://app.dover.com/api/v1/public/careers/${jobId}`,
    `https://app.dover.com/api/v1/careers/public/${jobId}`,
    `https://app.dover.com/api/v1/public/job-postings/${jobId}`,
    `https://app.dover.com/api/v1/job-postings/${jobId}/public`,
    `https://app.dover.com/api/v1/public/apply/${company}/${jobId}`,
    `https://app.dover.com/api/v1/apply/${company}/${jobId}`,
    `https://app.dover.com/api/v1/public/job_postings/${jobId}/`,
    `https://app.dover.com/api/v1/guest/job_postings/${jobId}`,
    `https://app.dover.com/api/v1/anonymous/job_postings/${jobId}`,
  ];

  for (const ep of endpoints) {
    const r = await fetch(ep, {
      headers: {
        ...FETCH_HEADERS,
        Accept: "application/json",
      },
    });
    const ct = r.headers.get("content-type") ?? "";
    const t = await r.text();
    if (ct.includes("json") && !t.startsWith("<!")) {
      console.log("HIT", ep, r.status, t.slice(0, 400));
    }
  }

  // lazy chunk with JobPosting
  const chunk = await (
    await fetch(
      "https://app.dover.com/static/search-builder2/static/js/index-CGpMfeKN.js",
      { headers: FETCH_HEADERS }
    )
  ).text();
  for (const term of ["job_posting", "getJob", "fetchJob", "/api/"]) {
    let i = 0,
      c = 0;
    while ((i = chunk.indexOf(term, i)) >= 0 && c < 3) {
      console.log("chunk", term, chunk.slice(i, i + 150));
      i++;
      c++;
    }
  }
}

async function probeGusto() {
  const slug = "toro-backend-developer-8f2d5640-8006-40e7-a966-b4342c87c85e";
  const urls = [
    `https://jobs.gusto.com/postings/${slug}`,
    `https://jobs.gusto.com/boards/toro/postings/${slug}`,
    `https://jobs.gusto.com/boards/toro`,
    `https://jobs.gusto.com/api/boards/toro/postings/${slug}`,
    `https://jobs.gusto.com/api/postings/${slug}`,
  ];

  for (const url of urls) {
    const r = await fetch(url, {
      headers: {
        ...FETCH_HEADERS,
        Accept: "application/json, text/html",
      },
    });
    const t = await r.text();
    console.log(
      "\n",
      url.replace("https://jobs.gusto.com", ""),
      r.status,
      t.includes("Just a moment") ? "CLOUDFLARE" : t.slice(0, 150)
    );
  }
}

async function main() {
  await probeDover();
  await probeGusto();
}

main();
