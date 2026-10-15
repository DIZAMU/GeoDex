import { describe, expect, it } from "vitest";
import type { CardState } from "./scheduler";
import {
  afterAnswer,
  arrange,
  buildQueue,
  nextItem,
  pickNewCards,
  type QueueItem,
  remaining,
  startSession,
  subregionOrder,
} from "./session";

const item = (
  entityId: string,
  subregion: string,
  type = "map_to_name",
  isNew = false,
): QueueItem => ({
  cardId: `${entityId}:${type}`,
  entityId,
  subregion,
  isNew,
});

function assertRules(queue: readonly QueueItem[]) {
  for (let i = 1; i < queue.length; i++) {
    expect(queue[i]?.entityId, `position ${i}`).not.toBe(queue[i - 1]?.entityId);
    if (i >= 2) {
      const run = [queue[i - 2], queue[i - 1], queue[i]];
      const allReviewSame = run.every((r) => r && !r.isNew && r.subregion === queue[i]?.subregion);
      expect(allReviewSame, `three reviews from ${queue[i]?.subregion} at ${i}`).toBe(false);
    }
  }
}

describe("buildQueue", () => {
  it("never shows the same entity twice in a row", () => {
    const due = ["NOR", "SWE", "FIN", "DNK"].flatMap((id, n) => [
      { ...item(id, "154"), retrievability: 0.5 + n / 10 },
      { ...item(id, "154", "name_to_map"), retrievability: 0.5 + n / 10 },
    ]);
    const fresh = [
      item("ISL", "154", "map_to_name", true),
      item("ISL", "154", "name_to_map", true),
    ];
    const queue = buildQueue(due, fresh);
    expect(queue).toHaveLength(10);
    for (let i = 1; i < queue.length; i++)
      expect(queue[i]?.entityId).not.toBe(queue[i - 1]?.entityId);
  });

  it("keeps at most two review cards in a row from one subregion when possible", () => {
    const due = [
      ...["NOR", "SWE", "FIN", "DNK"].map((id) => ({ ...item(id, "154"), retrievability: 0.3 })),
      ...["FRA", "DEU"].map((id) => ({ ...item(id, "155"), retrievability: 0.6 })),
    ];
    assertRules(buildQueue(due, []));
  });

  it("puts the lowest retrievability first and spreads new cards among reviews", () => {
    const due = [
      { ...item("A", "1"), retrievability: 0.9 },
      { ...item("B", "2"), retrievability: 0.2 },
      { ...item("C", "3"), retrievability: 0.5 },
      { ...item("D", "4"), retrievability: 0.7 },
    ];
    const queue = buildQueue(due, [item("N", "5", "map_to_name", true)]);
    expect(queue.map((q) => q.entityId)).toEqual(["B", "C", "N", "D", "A"]);
  });
});

describe("arrange", () => {
  it("keeps priority when no order satisfies the rules", () => {
    expect(arrange([item("A", "1"), item("A", "1", "name_to_map")]).map((q) => q.cardId)).toEqual([
      "A:map_to_name",
      "A:name_to_map",
    ]);
  });
});

describe("running a session", () => {
  const learning = (due: number): CardState => ({
    cardId: "x",
    phase: "learning",
    due,
    stability: 0.1,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 1,
    reps: 1,
    lapses: 0,
    lastReview: 0,
  });

  it("brings learning steps back once due, never right after the same entity", () => {
    let state = startSession([
      item("NOR", "154", "map_to_name", true),
      item("FRA", "155"),
      item("DEU", "155"),
    ]);
    const first = nextItem(state, 0);
    if (!first) throw new Error("empty");
    expect(first.item.entityId).toBe("NOR");
    state = afterAnswer(first.state, first.item, learning(60_000), 0);
    expect(remaining(state)).toBe(3);

    const second = nextItem(state, 30_000);
    expect(second?.item.entityId).toBe("FRA");
    if (!second) throw new Error("empty");
    const third = nextItem(afterAnswer(second.state, second.item, null, 30_000), 61_000);
    expect(third?.item.cardId).toBe("NOR:map_to_name");
    expect(third?.item.isNew).toBe(false);
  });

  it("ends when the queue and pending steps are empty", () => {
    expect(nextItem(startSession([]), 0)).toBeNull();
  });
});

describe("new cards", () => {
  it("orders subregions from home outward", () => {
    const countries = [
      { id: "NOR", subregion: "154", centroid: [10, 62] as const },
      { id: "FRA", subregion: "155", centroid: [2, 46] as const },
      { id: "JPN", subregion: "030", centroid: [138, 36] as const },
      { id: "BRA", subregion: "005", centroid: [-52, -10] as const },
    ];
    // Japan (about 8,500 km) is closer to Norway than Brazil (about 10,500 km).
    expect(subregionOrder("NOR", countries)).toEqual(["154", "155", "030", "005"]);
  });

  it("finishes unlocked stages of started entities before new subregions", () => {
    const picked = pickNewCards(
      [
        { ...item("JPN", "030", "map_to_name", true), stage: 1, introduced: false },
        { ...item("NOR", "154", "country_to_capital", true), stage: 2, introduced: true },
        { ...item("SWE", "154", "map_to_name", true), stage: 1, introduced: false },
      ],
      ["154", "030"],
      2,
    );
    expect(picked.map((p) => p.cardId)).toEqual(["NOR:country_to_capital", "SWE:map_to_name"]);
  });
});

describe("session limit", () => {
  const card = (id: string): QueueItem => ({
    cardId: `${id}:map_to_name`,
    entityId: id,
    subregion: "154",
    isNew: false,
  });

  it("ends after the limit even with cards left", () => {
    let state = startSession([card("NOR"), card("SWE"), card("FIN")], 2);
    expect(remaining(state)).toBe(2);
    for (let i = 0; i < 2; i++) {
      const next = nextItem(state, 0);
      if (!next) throw new Error("expected a card");
      state = afterAnswer(next.state, next.item, null, 0);
    }
    expect(remaining(state)).toBe(0);
    expect(nextItem(state, 0)).toBeNull();
  });
});
