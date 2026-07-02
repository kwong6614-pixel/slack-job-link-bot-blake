import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";
import { extractFromNextData } from "../src/lib/html-extract";

async function probeDoverHtml() {
  const jobId = "099f8ad4-ed41-45db-9753-b59adec16e7a";
  const html = await (
    await fetch(`https://app.dover.com/apply/TruTechnologies/${jobId}`, {
      headers: FETCH_HEADERS,
    })
  ).text();

  console.log("=== Dover HTML ===");
  console.log("len", html.length);
  const $ = cheerio.load(html);
  console.log("title", $("title").text());

  const next = extractFromNextData(html);
  console.log("next data extract", next?.slice(0, 400));

  for (const pat of ["jobPosting", "job_posting", "description", "099f8ad4"]) {
    const i = html.indexOf(pat);
    if (i >= 0) console.log(pat, html.slice(i, i + 200));
  }

  // search script tags for json
  $("script").each((_, el) => {
    const t = $(el).html() || "";
    if (t.includes("description") && t.includes("title") && t.length > 500) {
      console.log("script snippet", t.slice(0, 400));
    }
  });
}

async function probeGusto() {
  console.log("\n=== Gusto API attempts ===");
  const slug = "toro-backend-developer-8f2d5640-8006-40e7-a966-b4342c87c85e";
  const id = "8f2d5640-8006-40e7-a966-b4342c87c85e";

  const endpoints = [
    `https://jobs.gusto.com/api/postings/by-slug/${slug}`,
    `https://jobs.gusto.com/api/postings/${id}`,
    `https://api.gusto.com/job_board/postings/${id}`,
    `https://jobs.gusto.com/boards/api/postings/${slug}`,
  ];

  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        headers: {
          ...FETCH_HEADERS,
          Accept: "application/json",
        },
      });
      const t = await r.text();
      if (!t.includes("Just a moment")) {
        console.log(ep, r.status, t.slice(0, 200));
      }
    } catch (e) {
      console.log(ep, "err");
    }
  }

  // try embed / alternate host
  const alt = await fetch(
    `https://jobs.gusto.com/postings/${slug}`,
    {
      headers: {
        ...FETCH_HEADERS,
        Accept: "text/html",
        "Cache-Control": "no-cache",
      },
    }
  );
  console.log("direct", alt.status, (await alt.text()).slice(0, 100));
}

async function main() {
  await probeDoverHtml();
  await probeGusto();
}

main();
