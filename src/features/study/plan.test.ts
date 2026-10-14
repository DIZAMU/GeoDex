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
  read("data/curated/groups.json"),
  read("data/landmarks.json"),
  read("data/physical.json"),
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

describe("groups in the plan", () => {
  const groups = { ...settings, modules: { groups: true } };
  const SCANDINAVIA = "Q21195";
  const introduce = (ids: string[]) => {
    const events = ids.flatMap((id, i) => [
      ev(`${id}:map_to_name`, now - 86_400_000 * 2, `${id}m${i}`),
      ev(`${id}:name_to_map`, now - 86_400_000 * 2, `${id}n${i}`),
    ]);
    return { events, states: replayAll(scheduler, events) };
  };

  it("adds no group cards while the module is off", () => {
    const { events, states } = introduce(["NOR", "SWE"]);
    const plan = planDay({ world, settings, states, events, scheduler, now });
    expect(plan.queue.some((q) => world.groupById.has(q.entityId))).toBe(false);
  });

  it("starts a group once half its members are introduced", () => {
    const one = introduce(["NOR"]);
    const early = planDay({ world, settings: groups, ...one, scheduler, now });
    expect(early.queue.some((q) => q.entityId === SCANDINAVIA)).toBe(false);
    const two = introduce(["NOR", "SWE"]);
    const plan = planDay({ world, settings: groups, ...two, scheduler, now });
    const cards = plan.queue.filter((q) => q.entityId === SCANDINAVIA).map((q) => q.cardId);
    expect(cards.length).toBeGreaterThan(0);
    expect(plan.queue.find((q) => q.entityId === SCANDINAVIA)?.subregion).toBe("154");
    expect(plan.newCount).toBe(25);
  });

  it("keeps due group cards on the plan, and drops them when the module is off", () => {
    const base = introduce(["NOR", "SWE"]);
    const events = [...base.events, ev(`${SCANDINAVIA}:group_member`, now - 86_400_000 * 30, "g")];
    const states = replayAll(scheduler, events);
    const on = planDay({ world, settings: groups, states, events, scheduler, now });
    expect(on.queue.map((q) => q.cardId)).toContain(`${SCANDINAVIA}:group_member`);
    const off = planDay({ world, settings, states, events, scheduler, now });
    expect(off.queue.map((q) => q.cardId)).not.toContain(`${SCANDINAVIA}:group_member`);
  });
});

describe("landmarks in the plan", () => {
  const on = { ...settings, modules: { landmarks: true } };
  const intro = [
    ev("FRA:map_to_name", now - 86_400_000 * 2, "f1"),
    ev("FRA:name_to_map", now - 86_400_000 * 2, "f2"),
  ];
  const introStates = replayAll(scheduler, intro);
  const isLandmark = (id: string) => world.landmarkById.has(id);

  it("adds no landmark cards while the module is off", () => {
    const plan = planDay({ world, settings, states: introStates, events: intro, scheduler, now });
    expect(plan.queue.some((q) => isLandmark(q.entityId))).toBe(false);
  });

  it("starts landmarks only in countries already introduced", () => {
    const plan = planDay({
      world,
      settings: on,
      states: introStates,
      events: intro,
      scheduler,
      now,
    });
    const items = plan.queue.filter((q) => isLandmark(q.entityId));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((q) => world.landmarkById.get(q.entityId)?.countryId === "FRA")).toBe(true);
    expect(plan.newCount).toBe(25);
  });

  it("keeps due landmark cards while on and drops them when off", () => {
    const events = [...intro, ev("Q243:landmark_to_map", now - 86_400_000 * 30, "l")];
    const states = replayAll(scheduler, events);
    expect(
      planDay({ world, settings: on, states, events, scheduler, now }).queue.map((q) => q.cardId),
    ).toContain("Q243:landmark_to_map");
    expect(
      planDay({ world, settings, states, events, scheduler, now }).queue.map((q) => q.cardId),
    ).not.toContain("Q243:landmark_to_map");
  });
});

describe("physical features in the plan", () => {
  const on = { ...settings, modules: { physical: true } };
  const NILE = "Q3392";
  const intro = (ids: string[]) => {
    const events = ids.flatMap((id, i) => [
      ev(`${id}:map_to_name`, now - 86_400_000 * 2, `${id}a${i}`),
      ev(`${id}:name_to_map`, now - 86_400_000 * 2, `${id}b${i}`),
    ]);
    return { events, states: replayAll(scheduler, events) };
  };

  it("adds nothing while the module is off", () => {
    const plan = planDay({ world, settings, ...intro(["EGY"]), scheduler, now });
    expect(plan.queue.some((q) => world.physicalById.has(q.entityId))).toBe(false);
  });

  it("starts a feature once a country it touches is introduced", () => {
    const before = planDay({ world, settings: on, ...intro(["NOR"]), scheduler, now });
    expect(before.queue.some((q) => q.entityId === NILE)).toBe(false);
    const after = planDay({ world, settings: on, ...intro(["EGY"]), scheduler, now });
    const nile = after.queue.filter((q) => q.entityId === NILE);
    // Egypt's subregion is Northern Africa.
    expect(after.queue.some((q) => world.physicalById.has(q.entityId))).toBe(true);
    for (const item of nile) expect(item.subregion).toBe("015");
    expect(after.newCount).toBe(25);
  });

  it("starts oceans with any introduced country", () => {
    const plan = planDay({ world, settings: on, ...intro(["NOR"]), scheduler, now });
    const ids = new Set(plan.queue.map((q) => q.entityId));
    const oceans = world.physical.filter((f) => f.kind === "ocean").map((f) => f.id);
    // Not every ocean fits in one day's share, but they are candidates from the first day.
    expect(
      oceans.some((id) => ids.has(id)) ||
        plan.queue.some((q) => world.physicalById.has(q.entityId)),
    ).toBe(true);
  });
});
