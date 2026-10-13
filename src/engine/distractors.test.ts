import { describe, expect, it } from "vitest";
import {
  type CountryFacts,
  countryDistractors,
  currencyDistractors,
  flagSimilarity,
  languageDistractors,
} from "./distractors";
import { createRng } from "./random";

const c = (
  id: string,
  subregion: string,
  continent: string,
  extra: Partial<CountryFacts> = {},
): CountryFacts => ({
  id,
  subregion,
  continent,
  flagColors: [],
  currencies: [],
  languages: [],
  ...extra,
});

const countries: CountryFacts[] = [
  c("SVK", "151", "europe", { currencies: ["EUR"], languages: ["sk"] }),
  c("CZE", "151", "europe", { currencies: ["CZK"], languages: ["cs"] }),
  c("POL", "151", "europe", { currencies: ["PLN"], languages: ["pl"] }),
  c("HUN", "151", "europe", { currencies: ["HUF"], languages: ["hu"] }),
  c("SVN", "039", "europe", { currencies: ["EUR"], languages: ["sl"] }),
  c("HRV", "039", "europe", { currencies: ["EUR"], languages: ["hr"] }),
  c("ITA", "039", "europe", { currencies: ["EUR"], languages: ["it"] }),
  c("NOR", "154", "europe", { currencies: ["NOK"], languages: ["no", "smi"] }),
  c("TCD", "017", "africa", { flagColors: ["blue", "yellow", "red"], languages: ["fr", "ar"] }),
  c("ROU", "151", "europe", { flagColors: ["blue", "yellow", "red"] }),
  c("CMR", "017", "africa", { flagColors: ["green", "red", "yellow"], languages: ["fr", "en"] }),
  c("GAB", "017", "africa", { flagColors: ["green", "yellow", "blue"], languages: ["fr"] }),
  c("CAF", "017", "africa", {
    flagColors: ["blue", "white", "green", "yellow", "red"],
    languages: ["fr", "sg"],
  }),
  c("JPN", "030", "asia", { currencies: ["JPY"], languages: ["ja"] }),
];
const get = (id: string) => countries.find((x) => x.id === id) as CountryFacts;

describe("countryDistractors", () => {
  it("prefers the learner's confusions, then curated ones, then the subregion", () => {
    const picked = countryDistractors(get("SVK"), countries, {
      count: 3,
      rng: createRng(1),
      userConfusions: ["HRV"],
      curatedConfusions: ["SVN"],
      firstReview: false,
    });
    expect(picked[0]).toBe("HRV");
    expect(picked[1]).toBe("SVN");
    expect(["CZE", "POL", "HUN", "ROU"]).toContain(picked[2]);
  });

  it("stays on the continent after the first review", () => {
    for (let seed = 0; seed < 20; seed++) {
      const picked = countryDistractors(get("SVK"), countries, {
        count: 3,
        rng: createRng(seed),
        firstReview: false,
      });
      for (const id of picked) expect(get(id).continent).toBe("europe");
    }
  });

  it("prefers flags with similar colors", () => {
    const picked = countryDistractors(get("TCD"), countries, {
      count: 1,
      rng: createRng(3),
      curatedConfusions: [],
      firstReview: false,
      byFlag: true,
    });
    expect(picked).toEqual(["CAF"]);
    expect(flagSimilarity(["blue", "yellow", "red"], ["blue", "yellow", "red"])).toBe(1);
  });

  it("is deterministic for a seed and never includes the target", () => {
    const a = countryDistractors(get("NOR"), countries, {
      count: 3,
      rng: createRng("x"),
      firstReview: true,
    });
    const b = countryDistractors(get("NOR"), countries, {
      count: 3,
      rng: createRng("x"),
      firstReview: true,
    });
    expect(a).toEqual(b);
    expect(a).not.toContain("NOR");
    expect(new Set(a).size).toBe(3);
  });
});

describe("currency and language distractors", () => {
  it("never offers a currency the country uses", () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(currencyDistractors(get("SVK"), countries, 3, createRng(seed))).not.toContain("EUR");
    }
  });

  it("never offers an official or excluded language", () => {
    const tcd = { ...get("TCD"), languagesNotDistractors: ["sg"] };
    for (let seed = 0; seed < 20; seed++) {
      const picked = languageDistractors(tcd, countries, 3, createRng(seed));
      expect(picked).not.toContain("fr");
      expect(picked).not.toContain("ar");
      expect(picked).not.toContain("sg");
    }
  });
});
