import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function probeGusto() {
  const slug = "toro-backend-developer-8f2d5640-8006-40e7-a966-b4342c87c85e";
  const id = "8f2d5640-8006-40e7-a966-b4342c87c85e";

  const userAgents = [
    FETCH_HEADERS["User-Agent"],
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  ];

  const url = `https://jobs.gusto.com/postings/${slug}`;
  for (const ua of userAgents) {
    const r = await fetch(url, {
      headers: { ...FETCH_HEADERS, "User-Agent": ua },
    });
    const t = await r.text();
    console.log("UA", ua.slice(0, 30), r.status, t.includes("Just a moment") ? "CF" : t.slice(0, 100));
  }

  const apis = [
    `https://jobs.gusto.com/api/v1/postings/${id}`,
    `https://jobs.gusto.com/api/v1/postings/slug/${slug}`,
    `https://jobs.gusto.com/api/postings/by-id/${id}`,
    `https://hiring.gusto.com/api/postings/${id}`,
    `https://app.gusto.com/api/v1/job_postings/${id}`,
    `https://jobs.gusto.com/postings/${slug}/data.json`,
    `https://jobs.gusto.com/postings/${slug}/embed`,
  ];

  for (const ep of apis) {
    try {
      const r = await fetch(ep, {
        headers: { ...FETCH_HEADERS, Accept: "application/json" },
      });
      const t = await r.text();
      if (!t.includes("Just a moment") && !t.startsWith("<!")) {
        console.log("HIT", ep, r.status, t.slice(0, 300));
      } else {
        console.log(ep, r.status, t.includes("Just a moment") ? "CF" : "html");
      }
    } catch {
      console.log(ep, "err");
    }
  }
}

probeGusto();
