import { describe, expect, it } from "vitest";
import { allCountryCards, isIntroduced, stageOf, unlockedNewCards } from "./cards";
import type { CardState } from "./scheduler";

function state(
  id: string,
  stability: number,
  phase: CardState["phase"] = "review",
): [string, CardState] {
  return [
    id,
    {
      cardId: id,
      phase,
      due: 0,
      stability,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 3,
      lapses: 0,
      lastReview: 0,
    },
  ];
}

const opts = { currencyAndLanguage: true };

describe("unlockedNewCards", () => {
  it("offers the stage 1 pair for an entity not yet introduced", () => {
    expect(unlockedNewCards("NOR", new Map(), opts)).toEqual([
      "NOR:map_to_name",
      "NOR:name_to_map",
    ]);
    expect(isIntroduced("NOR", new Map())).toBe(false);
  });

  it("keeps stage 2 locked until both stage 1 cards reach 4 days of stability", () => {
    const partial = new Map([state("NOR:map_to_name", 5), state("NOR:name_to_map", 3.9)]);
    expect(unlockedNewCards("NOR", partial, opts)).toEqual([]);
    const learning = new Map([
      state("NOR:map_to_name", 5),
      state("NOR:name_to_map", 9, "learning"),
    ]);
    expect(unlockedNewCards("NOR", learning, opts)).toEqual([]);
  });

  it("unlocks stage 2, then stage 3, then stage 4", () => {
    const s1 = new Map([state("NOR:map_to_name", 4), state("NOR:name_to_map", 6)]);
    expect(unlockedNewCards("NOR", s1, opts)).toEqual([
      "NOR:country_to_capital",
      "NOR:capital_to_country",
    ]);
    const s2 = new Map([
      ...s1,
      state("NOR:country_to_capital", 4),
      state("NOR:capital_to_country", 4),
    ]);
    expect(unlockedNewCards("NOR", s2, opts)).toEqual(["NOR:flag_to_name", "NOR:name_to_flag"]);
    const s3 = new Map([...s2, state("NOR:flag_to_name", 8), state("NOR:name_to_flag", 8)]);
    expect(unlockedNewCards("NOR", s3, opts)).toEqual([
      "NOR:country_to_currency",
      "NOR:country_to_language",
    ]);
    expect(unlockedNewCards("NOR", s3, { currencyAndLanguage: false })).toEqual([]);
  });

  it("only returns cards that were never reviewed", () => {
    const s = new Map([
      state("NOR:map_to_name", 4),
      state("NOR:name_to_map", 6),
      state("NOR:country_to_capital", 1, "learning"),
    ]);
    expect(unlockedNewCards("NOR", s, opts)).toEqual(["NOR:capital_to_country"]);
  });
});

describe("card ids", () => {
  it("lists 8 cards with stage 4 enabled, 6 without", () => {
    expect(allCountryCards("NOR", opts)).toHaveLength(8);
    expect(allCountryCards("NOR", { currencyAndLanguage: false })).toHaveLength(6);
    expect(stageOf("flag_to_name")).toBe(3);
  });
});
