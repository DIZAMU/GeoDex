import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { findDashes, shouldCheck } from "./dashes.ts";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split("\n")
  .filter((path) => path !== "" && shouldCheck(path));

const hits = files.flatMap((path) => findDashes(path, readFileSync(path, "utf8")));

for (const hit of hits) {
  console.error(
    `${hit.path}:${hit.line}: en or em dash. Use a comma, colon, period or parentheses.`,
  );
  console.error(`  ${hit.text}`);
}

if (hits.length > 0) {
  console.error(`\n${hits.length} line(s) with dashes in ${files.length} checked files.`);
  process.exit(1);
}
console.log(`No en or em dashes in ${files.length} files.`);
