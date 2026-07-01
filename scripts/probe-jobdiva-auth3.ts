import { readFileSync } from "fs";

const js = readFileSync("scripts/jobdiva-bundle.js", "utf8");
const i = js.indexOf("setTokenA");
console.log(js.slice(i, i + 1500));

const j = js.indexOf("default.get=function");
console.log("\n--- get ---\n", js.slice(j, j + 800));
