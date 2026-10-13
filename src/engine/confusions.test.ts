import { describe, expect, it } from "vitest";
import { confusionScores, confusionsFor, contrastCardId, contrastCards } from "./confusions";
import { DAY_MS, parseCardId, type ReviewEventCore } from "./types";

const now = Date.UTC(2026, 5, 1);
const wrong = (cardId: string, chosen: string, daysAgo: number): ReviewEventCore => ({
  id: `${cardId}-${chosen}-${daysAgo}`,
  cardId,
  reviewedAt: now - daysAgo * DAY_MS,
  rating: 1,
  mode: "mc",
  correct: false,
  chosenAnswer: chosen,
  responseMs: 2000,
  scheduled: true,
});
const resolve = (e: ReviewEventCore): [string, string] | null =>
  e.chosenAnswer ? [parseCardId(e.cardId).entityId, e.chosenAnswer] : null;

describe("confusions", () => {
  const events = [
    wrong("SVK:map_to_name", "SVN", 1),
    wrong("SVN:name_to_map", "SVK", 30),
    wrong("SVK:map_to_name", "SVN", 120),
    wrong("NER:map_to_name", "NGA", 5),
  ];
  const scores = confusionScores(events, now, resolve);

  it("counts unordered pairs in the last 90 days", () => {
    expect(scores.get("SVK|SVN")).toBe(2);
    expect(scores.get("NER|NGA")).toBe(1);
  });

  it("creates a contrast card from a score of 2", () => {
    expect(contrastCards(scores)).toEqual(["SVK|SVN:contrast"]);
    expect(contrastCardId("SVN", "SVK")).toBe("SVK|SVN:contrast");
  });

  it("lists confusions for an entity, most confused first", () => {
    expect(confusionsFor("SVK", scores)).toEqual(["SVN"]);
    expect(confusionsFor("NGA", scores)).toEqual(["NER"]);
  });
});
