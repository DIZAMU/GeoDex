// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assembleWorld } from "@/data/world";
import { createScheduler, replayAll } from "@/engine/scheduler";
import { type PlanEvent, type PlanSettings, planDay } from "./plan";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const world = assembleWorld(
  read("data/countries.json"),
  read("data/geo/countries-50m.json"),
  read("data/flags-meta.json"),
  read("data/curated/official-languages.json"),
  read("data/curated/confusion-pairs.json"),
);
const scheduler = createScheduler();
const settings: PlanSettings = {
  homeCountry: "NOR",
  dailyMinutes: 18,
  newPerDayOverride: null,
  dayStartHour: 4,
  currencyAndLanguage: true,
  scope: { partiallyRecognized: false },
};
const now = new Date(2026, 5, 10, 9).getTime();
const ev = (cardId: string, at: number, id: string): PlanEvent => ({
  id,
  cardId,
  reviewedAt: at,
  rating: 3,
  mode: "mc",
  correct: true,
  chosenAnswer: null,
  responseMs: 3000,
  durationMs: 8000,
  scheduled: true,
});

describe("planDay", () => {
  it("starts a new learner with 25 new cards from the home region", () => {
    const plan = planDay({ world, settings, states: new Map(), events: [], scheduler, now });
    expect(plan.dueCount).toBe(0);
    expect(plan.newCount).toBe(25);
    expect(plan.queue.slice(0, 10).every((q) => q.subregion === "154")).toBe(true);
    expect(plan.nextSubregion).toBe("154");
    for (let i = 1; i < plan.queue.length; i++) {
      expect(plan.queue[i]?.entityId).not.toBe(plan.queue[i - 1]?.entityId);
    }
  });

  it("counts new cards started today against the allowance", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      ev(
        `${["NOR", "SWE", "FIN", "DNK", "ISL"][i % 5]}:${i < 5 ? "map_to_name" : "name_to_map"}`,
        now - 3_600_000,
        `e${i}`,
      ),
    );
    const states = replayAll(scheduler, events);
    const plan = planDay({ world, settings, states, events, scheduler, now });
    expect(plan.newCount).toBe(15);
    expect(plan.dueCount).toBe(10);
  });

  it("skips cards of entities out of scope but keeps their events", () => {
    const events = [
      ev("XKX:map_to_name", now - 86_400_000 * 3, "k1"),
      ev("ZZZ:map_to_name", now - 86_400_000 * 3, "z1"),
    ];
    const states = replayAll(scheduler, events);
    const plan = planDay({ world, settings, states, events, scheduler, now });
    expect(plan.queue.some((q) => q.entityId === "XKX" || q.entityId === "ZZZ")).toBe(false);
    const withKosovo = planDay({
      world,
      settings: { ...settings, scope: { partiallyRecognized: true } },
      states,
      events,
      scheduler,
      now,
    });
    expect(withKosovo.queue.some((q) => q.entityId === "XKX")).toBe(true);
  });
});
