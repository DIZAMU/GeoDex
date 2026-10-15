// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assembleWorld } from "@/data/world";
import type { CardState } from "@/engine/scheduler";
import { COUNTRY_CARD_TYPES } from "@/engine/types";
import { computeLevels, courseCards } from "./levels";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const world = assembleWorld(
  read("data/countries.json"),
  read("data/geo/countries-50m.json"),
  read("data/flags-meta.json"),
  read("data/curated/official-languages.json"),
  read("data/curated/confusion-pairs.json"),
  read("data/cities.json"),
  read("data/curated/groups.json"),
  read("data/landmarks.json"),
  read("data/physical.json"),
  read("data/history.json"),
);
const base = { scope: { partiallyRecognized: false }, currencyAndLanguage: true };
const core = world.countries.filter((c) => c.status === "un_member" || c.status === "un_observer");

function mastered(cardId: string): [string, CardState] {
  return [
    cardId,
    {
      cardId,
      phase: "review",
      due: 0,
      stability: 100,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 5,
      lapses: 0,
      lastReview: 0,
    },
  ];
}

describe("courseCards", () => {
  it("holds every country card of the default course and nothing else", () => {
    const cards = courseCards(world, base);
    expect(cards).toHaveLength(core.length * COUNTRY_CARD_TYPES.length);
    expect(new Set(cards.map((c) => c.cardId)).size).toBe(cards.length);
    expect(cards.every((c) => c.module === "countries" && c.continent !== null)).toBe(true);
  });

  it("drops currency and language when they are off", () => {
    const cards = courseCards(world, { ...base, currencyAndLanguage: false });
    expect(cards.some((c) => c.cardId.endsWith(":country_to_currency"))).toBe(false);
    expect(cards).toHaveLength(core.length * 6);
  });

  it("adds each module's cards when it is on, without duplicates", () => {
    const all = courseCards(world, {
      ...base,
      modules: { cities: true, groups: true, landmarks: true, physical: true, history: true },
    });
    expect(new Set(all.map((c) => c.cardId)).size).toBe(all.length);
    for (const m of ["cities", "groups", "landmarks", "physical", "history"])
      expect(
        all.some((c) => c.module === m),
        m,
      ).toBe(true);
    // Cities and landmarks count toward their country.
    const city = world.cities.find((c) => core.some((k) => k.id === c.countryId));
    const card = all.find((c) => c.module === "cities" && c.cardId.startsWith(`${city?.id}:`));
    expect(card?.countryId).toBe(city?.countryId);
  });
});

describe("computeLevels", () => {
  it("lifts a country, its continent and the total as its cards are mastered", () => {
    const cards = courseCards(world, base);
    const norway = cards.filter((c) => c.countryId === "NOR");
    const before = computeLevels(cards, new Map());
    const after = computeLevels(cards, new Map(norway.map((c) => mastered(c.cardId))));
    expect(before.country("NOR").level).toBe(1);
    expect(after.country("NOR").level).toBe(10);
    expect(after.byContinent.get("europe")?.share).toBeGreaterThan(0);
    expect(after.byContinent.get("asia")?.share).toBe(0);
    expect(after.overall.share).toBeCloseTo(norway.length / cards.length);
    expect(after.byModule.get("countries")?.share).toBeCloseTo(norway.length / cards.length);
  });
});
