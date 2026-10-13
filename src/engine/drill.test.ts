import { describe, expect, it } from "vitest";
import { drillQueue } from "./drill";
import type { CardState } from "./scheduler";

const countries = [
  { id: "NOR", subregion: "154" },
  { id: "SWE", subregion: "154" },
  { id: "FIN", subregion: "154" },
  { id: "DEU", subregion: "155" },
];
const studied = (cardId: string): [string, CardState] => [
  cardId,
  {
    cardId,
    phase: "review",
    due: 0,
    stability: 5,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 2,
    lapses: 0,
    lastReview: 0,
  },
];

describe("drill", () => {
  it("drills the studied cards of a region, never the same country twice in a row", () => {
    const states = new Map([
      studied("NOR:map_to_name"),
      studied("NOR:flag_to_name"),
      studied("SWE:map_to_name"),
      studied("DEU:map_to_name"),
    ]);
    const q = drillQueue({
      target: { kind: "region", subregion: "154" },
      countries,
      states,
      seed: "x",
    });
    expect(q.map((i) => i.cardId).sort()).toEqual([
      "NOR:flag_to_name",
      "NOR:map_to_name",
      "SWE:map_to_name",
    ]);
    for (let i = 1; i < q.length; i++) expect(q[i]?.entityId).not.toBe(q[i - 1]?.entityId);
  });

  it("falls back to location cards for a region not started yet, and caps the size", () => {
    const q = drillQueue({
      target: { kind: "region", subregion: "154" },
      countries,
      states: new Map(),
      seed: "y",
      size: 4,
    });
    expect(q).toHaveLength(4);
    expect(q.every((i) => /:(map_to_name|name_to_map)$/.test(i.cardId))).toBe(true);
  });

  it("drills a confused pair with its contrast card when one exists", () => {
    const states = new Map([studied("NOR|SWE:contrast")]);
    const q = drillQueue({
      target: { kind: "pair", a: "SWE", b: "NOR" },
      countries,
      states,
      seed: "z",
    });
    expect(q.map((i) => i.cardId)).toContain("NOR|SWE:contrast");
    expect(q).toHaveLength(7);
  });

  it("is deterministic for a seed", () => {
    const args = {
      target: { kind: "region" as const, subregion: "154" },
      countries,
      states: new Map(),
      seed: "s",
    };
    expect(drillQueue(args)).toEqual(drillQueue(args));
  });
});
