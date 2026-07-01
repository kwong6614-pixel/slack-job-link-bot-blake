import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function main() {
  const portalA =
    "tqjdnwtd2nqo43kj8rdgg48zv695o700479ucz7rjp0s14dmmt4cc2gvpzfoandr";
  const html = await (
    await fetch(`https://www1.jobdiva.com/portal/?a=${portalA}`, {
      headers: FETCH_HEADERS,
    })
  ).text();

  const scripts = [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/g)].map(
    (m) => m[1]
  );
  console.log("scripts", scripts);

  const inline = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((s) => s.length > 50);
  console.log("inline count", inline.length);
  for (const s of inline) {
    if (/job|api|rest|bundle|chunk|load/i.test(s)) {
      console.log("--- inline ---\n", s.slice(0, 800));
    }
  }

  const jobId = "28785322";
  const endpoints = [
    `https://www1.jobdiva.com/portal/rest/job/openings?a=${portalA}`,
    `https://www1.jobdiva.com/portal/rest/job/list?a=${portalA}`,
    `https://www1.jobdiva.com/portal/rest/jobs/open?a=${portalA}`,
    `https://www1.jobdiva.com/candidates/rest/job/openJobs?a=${portalA}`,
    `https://www1.jobdiva.com/candidates/rest/job/searchJobs?a=${portalA}&jobId=${jobId}`,
    `https://www1.jobdiva.com/candidates/rest/public/job/${jobId}?a=${portalA}`,
    `https://www1.jobdiva.com/candidates/rest/job/getJobDetail?a=${portalA}&jobId=${jobId}`,
    `https://www1.jobdiva.com/candidates/rest/job/getJobDetails?a=${portalA}&jobId=${jobId}`,
    `https://www1.jobdiva.com/candidates/rest/job/getJob?a=${portalA}&jobId=${jobId}`,
    `https://www1.jobdiva.com/candidates/rest/job/get?a=${portalA}&id=${jobId}`,
    `https://www1.jobdiva.com/candidates/rest/job/${jobId}?a=${portalA}`,
  ];

  for (const u of endpoints) {
    const r = await fetch(u, {
      headers: {
        ...FETCH_HEADERS,
        Accept: "application/json",
        Referer: `https://www1.jobdiva.com/portal/?a=${portalA}`,
      },
    });
    const t = await r.text();
    if (r.status === 200 && t.startsWith("{")) {
      console.log("HIT", u, t.slice(0, 300));
    } else if (r.status !== 404 && r.status !== 406) {
      console.log(u.split(".com")[1], r.status, t.slice(0, 100));
    }
  }
}

main();
