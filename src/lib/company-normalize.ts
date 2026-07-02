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

const DOMAIN_SUFFIXES = ["com", "io", "co", "ai", "net", "org"];

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

  return name.replace(/\s+/g, " ").trim();
}
