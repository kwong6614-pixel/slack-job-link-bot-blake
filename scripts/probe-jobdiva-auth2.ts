import { readFileSync } from "fs";

const js = readFileSync("scripts/jobdiva-bundle.js", "utf8");
const marker = 'Authorization:"Basic "+M';
const i = js.indexOf(marker);
console.log("idx", i);
console.log(js.slice(i - 800, i + 1200));
