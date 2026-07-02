import * as cheerio from "cheerio";
import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function main() {
  const jobId = "099f8ad4-ed41-45db-9753-b59adec16e7a";
  const html = await (
    await fetch(`https://app.dover.com/apply/TruTechnologies/${jobId}`, {
      headers: FETCH_HEADERS,
    })
  ).text();

  const $ = cheerio.load(html);
  $("script").each((_, el) => {
    const t = $(el).html() || "";
    if (t.length > 100 && (t.includes("title") || t.includes("description"))) {
      console.log("script len", t.length, t.slice(0, 500));
    }
  });

  const chunk = await (
    await fetch(
      "https://app.dover.com/static/search-builder2/static/js/index-CGpMfeKN.js",
      { headers: FETCH_HEADERS }
    )
  ).text();

  for (const term of [
    "public/job_postings",
    "job_postings/",
    "getPublicJob",
    "fetchPublic",
    "useJobPosting",
    "JobPostingQuery",
  ]) {
    let i = 0,
      c = 0;
    while ((i = chunk.indexOf(term, i)) >= 0 && c < 3) {
      console.log("\n", term, chunk.slice(Math.max(0, i - 40), i + 120));
      i++;
      c++;
    }
  }

  // try graphql
  const gql = await fetch("https://app.dover.com/graphql", {
    method: "POST",
    headers: {
      ...FETCH_HEADERS,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: `{ jobPosting(id: "${jobId}") { title description } }`,
    }),
  });
  console.log("\ngraphql", gql.status, (await gql.text()).slice(0, 300));
}

main();
