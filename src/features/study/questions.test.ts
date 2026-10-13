// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assembleWorld } from "@/data/world";
import type { CardState } from "@/engine/scheduler";
import {
  band,
  buildIndexes,
  buildQuestion,
  checkChoice,
  checkTyped,
  countryFacts,
  type StudyContext,
} from "./questions";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const world = assembleWorld(
  read("data/countries.json"),
  read("data/geo/countries-50m.json"),
  read("data/flags-meta.json"),
  read("data/curated/official-languages.json"),
  read("data/curated/confusion-pairs.json"),
);
const ctx: StudyContext = {
  world,
  locale: "en",
  facts: countryFacts(world, world.excludeAsDistractor),
  confusionsFor: () => [],
  contrastKind: (a, b) => ([a, b].sort().join("|") === "ROU|TCD" ? "flag" : "place"),
  curatedFor: (id, dimension) =>
    world.confusionPairs
      .filter((p) => p.dimension === dimension && (p.a === id || p.b === id))
      .map((p) => (p.a === id ? p.b : p.a)),
  indexes: buildIndexes(world, world.languageNames),
};

const state = (stability: number, reps = 3): CardState => ({
  cardId: "x",
  phase: "review",
  due: 0,
  stability,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps,
  lapses: 0,
  lastReview: 0,
});

describe("answer escalation (PLAN.md 5.4)", () => {
  it("uses multiple choice and the subregion while new, typing and wider views later", () => {
    expect(band(undefined)).toBe("new");
    expect(band(state(1.9))).toBe("new");
    expect(band(state(10))).toBe("middle");
    expect(band(state(30))).toBe("strong");

    const fresh = buildQuestion(ctx, "SVK:map_to_name", undefined, "auto", "s");
    expect(fresh.answer.kind).toBe("choice");
    expect(fresh.prompt).toMatchObject({ kind: "map", view: { kind: "countries" } });
    const strong = buildQuestion(ctx, "SVK:map_to_name", state(30), "auto", "s");
    expect(strong.answer.kind).toBe("typed");
    expect(strong.prompt).toMatchObject({ kind: "map", view: { kind: "world" } });
  });

  it("keeps multiple choice and the subregion zoom under the multiple choice setting", () => {
    const q = buildQuestion(ctx, "SVK:name_to_map", state(30), "mc", "s");
    expect(q.answer).toMatchObject({ kind: "map", view: { kind: "countries" } });
    expect(buildQuestion(ctx, "SVK:country_to_capital", state(30), "mc", "s").answer.kind).toBe(
      "choice",
    );
  });

  it("offers 4 flags while new and 6 later, with the target among them", () => {
    const fresh = buildQuestion(ctx, "TCD:name_to_flag", undefined, "auto", "s");
    const later = buildQuestion(ctx, "TCD:name_to_flag", state(5), "auto", "s");
    if (fresh.answer.kind !== "flags" || later.answer.kind !== "flags")
      throw new Error("not flags");
    expect(fresh.answer.options).toHaveLength(4);
    expect(later.answer.options).toHaveLength(6);
    expect(later.answer.options.map((o) => o.id)).toContain("TCD");
  });
});

describe("multiple choice", () => {
  it.each([
    "map_to_name",
    "country_to_capital",
    "capital_to_country",
    "flag_to_name",
    "country_to_currency",
    "country_to_language",
  ])("%s has 4 distinct options with exactly one correct", (type) => {
    for (const id of ["NOR", "ZAF", "BOL", "TCD", "TUV", "SVK", "CHE", "ZWE"]) {
      const q = buildQuestion(ctx, `${id}:${type}`, undefined, "auto", `seed-${id}`);
      if (q.answer.kind !== "choice") throw new Error("not choice");
      const ids = q.answer.options.map((o) => o.id);
      expect(new Set(ids).size, `${id}:${type}`).toBe(4);
      expect(
        ids.filter((x) => q.correctIds.includes(x)),
        `${id}:${type}`,
      ).toHaveLength(1);
    }
  });

  it("is deterministic for the same seed", () => {
    expect(buildQuestion(ctx, "NOR:map_to_name", undefined, "auto", "a")).toEqual(
      buildQuestion(ctx, "NOR:map_to_name", undefined, "auto", "a"),
    );
  });

  it("prefers curated look-alikes from the first review", () => {
    const q = buildQuestion(ctx, "SVK:map_to_name", undefined, "auto", "x");
    if (q.answer.kind !== "choice") throw new Error("not choice");
    expect(q.answer.options.map((o) => o.id)).toContain("SVN");
  });
});

describe("checking answers", () => {
  it("accepts any capital of a multi-capital country, typed in either language", () => {
    const q = buildQuestion(ctx, "ZAF:country_to_capital", state(30), "auto", "x");
    expect(checkTyped(q, ctx.indexes, "Cape Town").correct).toBe(true);
    expect(checkTyped(q, ctx.indexes, "pretoria").correct).toBe(true);
    expect(checkTyped(q, ctx.indexes, "Johannesburg").correct).toBe(false);
  });

  it("accepts Norwegian names when the interface is English", () => {
    const q = buildQuestion(ctx, "DEU:flag_to_name", state(30), "auto", "x");
    expect(checkTyped(q, ctx.indexes, "Tyskland")).toMatchObject({ correct: true, typo: false });
  });

  it("accepts a currency by name or ISO code, and reports the nearest wrong country", () => {
    const q = buildQuestion(ctx, "NOR:country_to_currency", state(30), "auto", "x");
    expect(checkTyped(q, ctx.indexes, "NOK").correct).toBe(true);
    expect(checkTyped(q, ctx.indexes, "norsk krone").correct).toBe(true);
    const n = buildQuestion(ctx, "NGA:flag_to_name", state(30), "auto", "x");
    expect(checkTyped(n, ctx.indexes, "Niger")).toMatchObject({ correct: false, chosenId: "NER" });
    expect(checkChoice(n, "NGA").correct).toBe(true);
  });
});

describe("contrast cards", () => {
  it("asks for one of the pair, as two map shapes or two flags", () => {
    const place = buildQuestion(ctx, "SVK|SVN:contrast", undefined, "auto", "s1");
    expect(["SVK", "SVN"]).toContain(place.entityId);
    expect(place.correctIds).toEqual([place.entityId]);
    expect(place.answer).toMatchObject({ kind: "map" });
    if (place.answer.kind !== "map") throw new Error("map");
    expect([...(place.answer.selectable ?? [])].sort()).toEqual(["SVK", "SVN"]);

    const flags = buildQuestion(ctx, "ROU|TCD:contrast", undefined, "auto", "s1");
    expect(flags.answer.kind).toBe("flags");
    if (flags.answer.kind !== "flags") throw new Error("flags");
    expect(flags.answer.options.map((o) => o.id).sort()).toEqual(["ROU", "TCD"]);
  });

  it("asks for both countries across reviews", () => {
    const asked = new Set(
      Array.from(
        { length: 12 },
        (_, i) => buildQuestion(ctx, "SVK|SVN:contrast", undefined, "auto", `seed${i}`).entityId,
      ),
    );
    expect([...asked].sort()).toEqual(["SVK", "SVN"]);
  });
});
