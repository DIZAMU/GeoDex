/**
 * Runs the data build twice from the raw cache and fails unless every output is
 * byte-identical. Run with: pnpm data:verify
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OUTPUTS = [
  "data/countries.json",
  "data/cities.json",
  "data/landmarks.json",
  "data/physical.json",
  "data/history.json",
  "data/geo/countries-50m.json",
  "data/flags-meta.json",
  "data/name-mismatches.md",
  "data/neighbor-mismatches.md",
  "data/build-report.md",
  ...readdirSync("public/flags").map((file) => join("public/flags", file)),
];

function build(): Map<string, string> {
  execFileSync("node", ["scripts/data/build-countries.ts"], { stdio: "ignore" });
  execFileSync("node", ["scripts/data/build-flags.ts"], { stdio: "ignore" });
  execFileSync("node", ["scripts/data/build-cities.ts"], { stdio: "ignore" });
  execFileSync("node", ["scripts/data/build-landmarks.ts"], { stdio: "ignore" });
  execFileSync("node", ["scripts/data/build-physical.ts"], { stdio: "ignore" });
  execFileSync("node", ["scripts/data/build-history.ts"], { stdio: "ignore" });
  return new Map(
    OUTPUTS.map((path) => [path, createHash("sha256").update(readFileSync(path)).digest("hex")]),
  );
}

const firstRun = build();
const secondRun = build();
const changed = OUTPUTS.filter((path) => firstRun.get(path) !== secondRun.get(path));
if (changed.length > 0) {
  console.error(`Not deterministic: ${changed.join(", ")}`);
  process.exit(1);
}
console.log(`Deterministic: ${OUTPUTS.length} outputs identical across two builds.`);
