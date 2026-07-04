const LEGAL_SUFFIXES = [
  "incorporated",
  "corporation",
  "company",
  "limited",
  "holdings",
  "llc",
  "llp",
  "plc",
  "ltd",
  "gmbh",
  "inc",
  "corp",
  "co",
  "ag",
  "sa",
  "nv",
  "bv",
  "group",
];

const DOMAIN_SUFFIXES = ["com", "io", "co", "ai", "net", "org", "tv"];

function tokenKey(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dedupeCompanyTokens(words: string[]): string[] {
  const filtered = words.map((w) => w.trim()).filter(Boolean);
  const result: string[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const current = tokenKey(filtered[i]);
    if (!current) continue;

    if (result.length > 0) {
      const prev = tokenKey(result[result.length - 1]);
      if (current === prev) continue;
      if (prev.startsWith(current) && prev.length > current.length) continue;
      if (current.startsWith(prev) && current.length > prev.length) {
        result[result.length - 1] = filtered[i];
        continue;
      }
    }

    if (i + 1 < filtered.length) {
      const next = tokenKey(filtered[i + 1]);
      if (current === next) continue;
      if (next.startsWith(current) && next.length > current.length) continue;
      if (current.startsWith(next) && current.length > next.length) continue;
    }

    result.push(filtered[i]);
  }

  const seen = new Set<string>();
  const final: string[] = [];
  for (const word of result) {
    const key = tokenKey(word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    final.push(word);
  }

  return final;
}

export function normalizeCompanyName(value: string): string {
  if (!value) return "";

  let name = value.trim().toLowerCase();

  for (const domain of DOMAIN_SUFFIXES) {
    const re = new RegExp(`\\.${domain}$`, "i");
    if (re.test(name)) {
      name = name.replace(re, "").trim();
      break;
    }
  }

  name = name.replace(/[&,/()]/g, " ");
  name = name.replace(/[.'"]/g, "");
  name = name.replace(/\s+/g, " ").trim();

  let prev = "";
  while (prev !== name) {
    prev = name;
    for (const suffix of LEGAL_SUFFIXES) {
      const re = new RegExp(`\\s+${suffix}$`);
      if (re.test(name)) {
        name = name.replace(re, "").trim();
        break;
      }
    }
  }

  name = name.replace(/^the\s+/, "");

  const tokens = dedupeCompanyTokens(name.split(/\s+/));
  return tokens.join(" ").trim();
}

/** Canonical company name for sheets and dedup (suffixes stripped, title-cased). */
export function normalizeCompanyNameForSheet(value: string): string {
  const key = normalizeCompanyName(value);
  if (!key) return "";

  return key.replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
