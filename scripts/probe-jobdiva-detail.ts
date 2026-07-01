import { FETCH_HEADERS } from "../src/lib/fetch-page";

async function main() {
  const portalA =
    "tqjdnwtd2nqo43kj8rdgg48zv695o700479ucz7rjp0s14dmmt4cc2gvpzfoandr";
  const jobId = "28785322";

  const authResp = await fetch(
    "https://ws.jobdiva.com/candPortal/rest/auth/a",
    {
      headers: {
        Authorization: "Basic YXhlbG9uOmF4ZWxvbg==",
        portalID: "1",
        a: portalA,
        compid: "-1",
        Accept: "application/json",
        "User-Agent": FETCH_HEADERS["User-Agent"],
      },
    }
  );
  const authData = await authResp.json();
  console.log("auth", authData);

  const detailUrl = `https://ws.jobdiva.com/candPortal/rest/job/getdetailbyjobid/${jobId}?compid=${authData.compid}`;

  const headerSets = [
    {
      Authorization: `Basic ${authData.auth}`,
      portalID: String(authData.portalID),
      a: authData.a,
      compid: String(authData.compid),
    },
    {
      Authorization: `Bearer ${authData.token}`,
      portalID: String(authData.portalID),
      a: authData.a,
      compid: String(authData.compid),
    },
    {
      Authorization: `Basic ${authData.auth}`,
      token: authData.token,
      portalID: String(authData.portalID),
      a: authData.a,
      compid: String(authData.compid),
    },
  ];

  for (const headers of headerSets) {
    const r = await fetch(detailUrl, {
      headers: {
        ...FETCH_HEADERS,
        Accept: "application/json",
        ...headers,
      },
    });
    const t = await r.text();
    console.log("\nheaders", headers.Authorization?.slice(0, 20), r.status);
    console.log(t.slice(0, 500));
  }

  const listUrl = `https://ws.jobdiva.com/candPortal/rest/job/listall?portaltype=1&count=50`;
  const listResp = await fetch(listUrl, {
    headers: {
      ...FETCH_HEADERS,
      Accept: "application/json",
      Authorization: `Basic ${authData.auth}`,
      portalID: String(authData.portalID),
      a: authData.a,
      compid: String(authData.compid),
    },
  });
  console.log("\nlistall", listResp.status, (await listResp.text()).slice(0, 400));
}

main();
