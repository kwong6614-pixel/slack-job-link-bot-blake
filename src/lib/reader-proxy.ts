const JINA_READER_BASE = "https://r.jina.ai/";

export function isCloudflareChallenge(html: string): boolean {
  return (
    html.includes("Just a moment") ||
    html.includes("cf-browser-verification") ||
    html.includes("challenge-platform")
  );
}

export function parseJinaReaderMarkdown(raw: string): {
  title: string;
  body: string;
} | null {
  const titleMatch = raw.match(/^Title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? "";

  const contentMatch = raw.match(/Markdown Content:\s*\n([\s\S]+)$/);
  const body = contentMatch?.[1]?.trim() ?? "";
  if (body.length < 50) return null;

  return { title, body };
}

export async function fetchViaJinaReader(url: string): Promise<string | null> {
  try {
    const response = await fetch(`${JINA_READER_BASE}${encodeURIComponent(url)}`, {
      headers: { Accept: "text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) return null;

    const raw = await response.text();
    const parsed = parseJinaReaderMarkdown(raw);
    if (!parsed) return null;

    const titleLine = parsed.title
      ? `Job Title: ${parsed.title.replace(/\s+at\s+.+$/i, "").trim()}`
      : "";

    return [titleLine, "", parsed.body].filter(Boolean).join("\n").slice(0, 30_000);
  } catch {
    return null;
  }
}
