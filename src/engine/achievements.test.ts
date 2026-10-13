import { describe, expect, it } from "vitest";
import { computeAchievements, isMastered, skillOf } from "./achievements";
import { createScheduler, replayAll } from "./scheduler";
import type { Rating, ReviewEventCore } from "./types";

const scheduler = createScheduler();
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1, 10);
let n = 0;
const ev = (cardId: string, at: number, rating: Rating = 3): ReviewEventCore => {
  n += 1;
  return {
    id: `a${String(n).padStart(5, "0")}`,
    cardId,
    reviewedAt: at,
    rating,
    mode: "mc",
    correct: rating > 1,
    chosenAnswer: null,
    responseMs: 2000,
    scheduled: true,
  };
};

/** Reviews a card at each due date with Easy until it is mastered; returns the events. */
function master(cardId: string, start: number): ReviewEventCore[] {
  const events: ReviewEventCore[] = [];
  let at = start;
  for (let i = 0; i < 12; i++) {
    events.push(ev(cardId, at, 4));
    const state = replayAll(scheduler, events).get(cardId);
    if (isMastered(state)) return events;
    at = Math.max(at + 60_000, state?.due ?? at);
  }
  throw new Error(`could not master ${cardId}`);
}

const countries = [
  { id: "AAA", subregion: "s1", continent: "c1" },
  { id: "BBB", subregion: "s1", continent: "c1" },
  { id: "CCC", subregion: "s2", continent: "c2" },
];

describe("achievements", () => {
  it("maps card types to skills", () => {
    expect(skillOf("flag_to_name")).toBe("flags");
    expect(skillOf("country_to_language")).toBe("currency_language");
    expect(skillOf("contrast")).toBeNull();
  });

  it("earns a region, then its continent, then the world, at the moment each first holds", () => {
    const events = [
      ...master("AAA:map_to_name", T0),
      ...master("AAA:name_to_map", T0 + DAY),
      ...master("BBB:map_to_name", T0 + 2 * DAY),
    ];
    let got = computeAchievements({ scheduler, events, countries });
    expect(got).toEqual([]);
    events.push(...master("BBB:name_to_map", T0 + 3 * DAY));
    got = computeAchievements({ scheduler, events, countries });
    expect(got.map((a) => a.id)).toEqual(["region:location:s1", "continent:location:c1"]);
    const last = Math.max(...events.map((e) => e.reviewedAt));
    expect(got[0]?.earnedAt).toBe(last);

    events.push(
      ...master("CCC:map_to_name", last + DAY),
      ...master("CCC:name_to_map", last + 2 * DAY),
    );
    got = computeAchievements({ scheduler, events, countries });
    expect(got.map((a) => a.id)).toContain("world:location");
  });

  it("never revokes an achievement when a card later lapses", () => {
    const events = [...master("CCC:map_to_name", T0), ...master("CCC:name_to_map", T0 + DAY)];
    const before = computeAchievements({ scheduler, events, countries });
    expect(before.map((a) => a.id)).toContain("region:location:s2");
    events.push(ev("CCC:map_to_name", T0 + 400 * DAY, 1));
    const after = computeAchievements({ scheduler, events, countries });
    expect(after).toEqual(before);
  });

  it("earns Untangled for a mastered contrast card and adds streak milestones", () => {
    const got = computeAchievements({
      scheduler,
      events: master("AAA|BBB:contrast", T0),
      countries,
      streak: { milestones: [{ days: 7, at: T0 + 7 * DAY }] },
    });
    expect(got.map((a) => a.id).sort()).toEqual(["streak:7", "untangled:AAA|BBB"]);
  });
});
