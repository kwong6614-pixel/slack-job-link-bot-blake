import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function probeGusto() {
  const url =
    "https://jobs.gusto.com/postings/toro-backend-developer-8f2d5640-8006-40e7-a966-b4342c87c85e";
  console.log("\n=== Gusto ===");
  const r = await fetch(url, { headers: FETCH_HEADERS, redirect: "follow" });
  const html = await r.text();
  const $ = cheerio.load(html);
  console.log("status", r.status, "len", html.length, "title", $("title").text());
  console.log("ld+json", $('script[type="application/ld+json"]').length);
  console.log("__NEXT_DATA__", html.includes("__NEXT_DATA__"));
  console.log("body", $("body").text().replace(/\s+/g, " ").slice(0, 200));

  const slug = "toro-backend-developer-8f2d5640-8006-40e7-a966-b4342c87c85e";
  const endpoints = [
    `https://jobs.gusto.com/api/postings/${slug}`,
    `https://jobs.gusto.com/api/v1/postings/${slug}`,
    `https://jobs.gusto.com/postings/${slug}.json`,
  ];
  for (const ep of endpoints) {
    const resp = await fetch(ep, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
    });
    const t = await resp.text();
    if (!t.startsWith("<!")) console.log(ep, resp.status, t.slice(0, 300));
  }
}

async function probeDover() {
  const jobId = "099f8ad4-ed41-45db-9753-b59adec16e7a";
  console.log("\n=== Dover ===");
  const endpoints = [
    `https://app.dover.com/api/v1/careers/${jobId}`,
    `https://app.dover.com/api/v1/public/job_postings/${jobId}`,
    `https://app.dover.com/api/v1/job_postings/${jobId}`,
    `https://app.dover.com/api/public/job_postings/${jobId}`,
    `https://app.dover.com/api/v2/public/job_postings/${jobId}`,
    `https://app.dover.com/api/v1/public/jobs/${jobId}`,
    `https://app.dover.com/api/v1/jobs/${jobId}`,
  ];
  for (const ep of endpoints) {
    const r = await fetch(ep, {
      headers: { ...FETCH_HEADERS, Accept: "application/json" },
    });
    const ct = r.headers.get("content-type") ?? "";
    const t = await r.text();
    console.log(ep.split("dover.com")[1], r.status, ct.slice(0, 30), t.slice(0, 150));
  }

  const html = await (
    await fetch(
      `https://app.dover.com/apply/TruTechnologies/${jobId}`,
      { headers: FETCH_HEADERS }
    )
  ).text();
  console.log("html len", html.length, "ld+json", html.includes("JobPosting"));
  if (html.includes("__NEXT_DATA__")) {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    console.log("next data", m?.[1]?.slice(0, 500));
  }
}

async function probeIcims() {
  console.log("\n=== iCIMS ===");
  const url =
    "https://careers-sunauto.icims.com/jobs/21676/operations-reporting-analyst/job?in_iframe=1&mode=job";
  const r = await fetch(url, {
    headers: {
      ...FETCH_HEADERS,
      Referer: "https://careers-sunauto.icims.com/",
    },
  });
  console.log("status", r.status, (await r.text()).slice(0, 150));
}

async function main() {
  await probeGusto();
  await probeDover();
  await probeIcims();
}

main();
