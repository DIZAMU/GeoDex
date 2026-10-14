// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assembleWorld } from "@/data/world";
import { outlinedEntities, outlinesAt } from "./Timeline";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const world = assembleWorld(
  read("data/countries.json"),
  read("data/geo/countries-50m.json"),
  read("data/flags-meta.json"),
  read("data/curated/official-languages.json"),
  read("data/curated/confusion-pairs.json"),
  undefined,
  undefined,
  undefined,
  undefined,
  read("data/history.json"),
);

describe("borders over time", () => {
  const all = outlinedEntities(world);
  it("shows the outlines whose period includes the year, oldest first", () => {
    const at = outlinesAt(all, 117).map((e) => e.names.en);
    expect(at).toEqual(["Han dynasty", "Roman Empire"]);
    expect(outlinesAt(all, 1960).map((e) => e.names.en)).toContain("United Arab Republic");
    expect(outlinesAt(all, 1960).map((e) => e.names.en)).not.toContain("Austria-Hungary");
  });
  it("includes both ends of a period and leaves out former names", () => {
    expect(outlinesAt(all, 1453).map((e) => e.id)).toContain("Q12544");
    expect(all.every((e) => e.kind !== ("former_name" as string))).toBe(true);
  });
});
