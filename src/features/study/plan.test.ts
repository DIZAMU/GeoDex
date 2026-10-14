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
  read("data/cities.json"),
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

describe("contrast cards in the plan", () => {
  const miss = (id: string, at: number): PlanEvent => ({
    ...ev("SVN:map_to_name", at, id),
    rating: 1,
    correct: false,
    chosenAnswer: "SVK",
  });
  const events = [miss("m1", now - 86_400_000), miss("m2", now - 3_600_000)];
  const states = replayAll(scheduler, events);
  const content = {
    confusion: (a: string, b: string) => ([a, b].sort().join("|") === "SVK|SVN" ? {} : undefined),
  };

  it("adds a contrast card after two confusions when contrast text exists", () => {
    const plan = planDay({ world, settings, states, events, scheduler, now, content });
    expect(plan.queue.map((q) => q.cardId)).toContain("SVK|SVN:contrast");
  });

  it("adds none without contrast text", () => {
    const plan = planDay({ world, settings, states, events, scheduler, now });
    expect(plan.queue.some((q) => q.cardId.endsWith(":contrast"))).toBe(false);
  });
});

describe("cities in the plan", () => {
  const cities = {
    ...settings,
    modules: { cities: true },
    moduleWeights: { countries: 3, cities: 1 },
  };
  // Australia introduced well before today, so its cities (Sydney, Melbourne) can start.
  const intro = [
    ev("AUS:map_to_name", now - 86_400_000 * 2, "a1"),
    ev("AUS:name_to_map", now - 86_400_000 * 2, "a2"),
  ];
  const introStates = replayAll(scheduler, intro);
  const isCity = (id: string) => world.cityById.has(id);

  it("adds no city cards while the module is off", () => {
    const plan = planDay({ world, settings, states: introStates, events: intro, scheduler, now });
    expect(plan.queue.some((q) => isCity(q.entityId))).toBe(false);
  });

  it("starts cities only in countries already introduced, and splits new cards by weight", () => {
    const plan = planDay({
      world,
      settings: cities,
      states: introStates,
      events: intro,
      scheduler,
      now,
    });
    const cityItems = plan.queue.filter((q) => isCity(q.entityId));
    expect(cityItems.length).toBeGreaterThan(0);
    expect(cityItems.every((q) => world.cityById.get(q.entityId)?.countryId === "AUS")).toBe(true);
    // Sydney and Melbourne: 2 cities x 2 cards at most, below their 1-in-4 share.
    expect(cityItems.length).toBeLessThanOrEqual(4);
    expect(plan.newCount).toBe(25);
  });

  it("seeds the not-the-capital contrast card once the city has been studied", () => {
    const content = {
      confusion: (a: string, b: string) =>
        [a, b].sort().join("|") === ["Q3130", "Q3114"].sort().join("|")
          ? { contrast: {} }
          : undefined,
      confusions: [{ a: "Q3130", b: "Q3114", dimension: "not_capital" }],
    };
    const before = planDay({
      world,
      settings: cities,
      states: introStates,
      events: intro,
      scheduler,
      now,
      content,
    });
    expect(before.queue.some((q) => q.cardId.endsWith(":contrast"))).toBe(false);
    const events = [...intro, ev("Q3130:city_to_country", now - 86_400_000, "s1")];
    const states = replayAll(scheduler, events);
    const after = planDay({ world, settings: cities, states, events, scheduler, now, content });
    expect(after.queue.map((q) => q.cardId)).toContain("Q3114|Q3130:contrast");
    // Off again: the seeded card and the city card both drop out.
    const off = planDay({ world, settings, states, events, scheduler, now, content });
    expect(off.queue.some((q) => q.entityId.includes("Q3130"))).toBe(false);
  });

  it("keeps due city cards while the module is on", () => {
    const events = [...intro, ev("Q3130:city_to_country", now - 86_400_000 * 30, "s1")];
    const states = replayAll(scheduler, events);
    const plan = planDay({ world, settings: cities, states, events, scheduler, now });
    expect(plan.queue.some((q) => q.cardId === "Q3130:city_to_country" && !q.isNew)).toBe(true);
  });
});
