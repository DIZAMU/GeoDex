import { describe, expect, it } from "vitest";
import { buildIndex, editDistance, matchAnswer, normalizeAnswer, typoThreshold } from "./matching";

const index = buildIndex([
  { id: "DEU", names: ["Germany", "Tyskland"] },
  { id: "AUT", names: ["Austria", "Østerrike"] },
  { id: "AUS", names: ["Australia", "Australia"] },
  { id: "NER", names: ["Niger"] },
  { id: "NGA", names: ["Nigeria"] },
  { id: "CIV", names: ["Côte d'Ivoire", "Ivory Coast", "Elfenbenskysten", "Elfenbeinskysten"] },
  { id: "GMB", names: ["Gambia", "The Gambia"] },
  { id: "Q1899", names: ["Kyiv", "Kiev"] },
  { id: "GIN", names: ["Guinea"] },
  { id: "GNB", names: ["Guinea-Bissau"] },
]);

describe("normalizeAnswer", () => {
  it("folds case, diacritics, punctuation and Nordic letters", () => {
    expect(normalizeAnswer("Côte d'Ivoire")).toBe("cote divoire");
    expect(normalizeAnswer("Østerrike")).toBe("osterrike");
    expect(normalizeAnswer("  Guinea-Bissau ")).toBe("guinea bissau");
    expect(normalizeAnswer("Ålesund")).toBe("aalesund");
    expect(normalizeAnswer("The Gambia")).toBe("gambia");
    expect(normalizeAnswer("São Tomé")).toBe("sao tome");
  });
});

describe("editDistance", () => {
  it("counts adjacent transpositions as one edit", () => {
    expect(editDistance("norway", "nrway")).toBe(1);
    expect(editDistance("norway", "nowray")).toBe(1);
    expect(editDistance("austria", "australia")).toBe(2);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("uses length-based thresholds", () => {
    expect([4, 5, 8, 9].map(typoThreshold)).toEqual([0, 1, 1, 2]);
  });
});

describe("matchAnswer", () => {
  it("accepts names in either language", () => {
    expect(matchAnswer("Tyskland", "DEU", index).kind).toBe("exact");
    expect(matchAnswer("germany", "DEU", index).kind).toBe("exact");
  });

  it("accepts aliases (Kiev for Kyiv)", () => {
    expect(matchAnswer("Kiev", "Q1899", index)).toMatchObject({ kind: "exact", matched: "Kiev" });
  });

  it("accepts Côte d'Ivoire with or without accents and apostrophe", () => {
    for (const typed of ["Côte d'Ivoire", "cote divoire", "Cote d Ivoire", "ivory coast"]) {
      expect(matchAnswer(typed, "CIV", index).kind, typed).not.toBe("wrong");
    }
  });

  it("accepts Østerrike typed as osterrike", () => {
    expect(matchAnswer("osterrike", "AUT", index).kind).toBe("exact");
  });

  it("accepts a small typo and reports the correct spelling", () => {
    expect(matchAnswer("Germny", "DEU", index)).toMatchObject({ kind: "typo", matched: "Germany" });
  });

  it("rejects Niger for Nigeria and Austria for Australia", () => {
    expect(matchAnswer("Niger", "NGA", index)).toEqual({ kind: "wrong", nearestId: "NER" });
    expect(matchAnswer("Austria", "AUS", index)).toEqual({ kind: "wrong", nearestId: "AUT" });
  });

  it("rejects a typo that is also close to another entity", () => {
    // "nigeia" is one edit from Nigeria and two from Niger, so it passes.
    // "nigera" is one edit from both, so it is ambiguous and rejected.
    expect(matchAnswer("nigeia", "NGA", index).kind).toBe("typo");
    expect(matchAnswer("nigera", "NGA", index).kind).toBe("wrong");
  });

  it("does not allow typos on short names", () => {
    expect(matchAnswer("Kyv", "Q1899", index).kind).toBe("wrong");
  });

  it("treats empty input as wrong", () => {
    expect(matchAnswer("  ", "DEU", index)).toEqual({ kind: "wrong", nearestId: null });
  });
});
