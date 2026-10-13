import { describe, expect, it } from "vitest";
import {
  answerPlacement,
  currentQuestion,
  PLACEMENT_MAX_QUESTIONS,
  type PlacementState,
  placementReview,
  skipSubregion,
  startPlacement,
} from "./placement";

const members = {
  "154": ["NOR", "SWE", "FIN", "DNK"],
  "155": ["FRA", "DEU", "BEL"],
  "030": ["JPN", "KOR"],
};
const start = () =>
  startPlacement({ order: ["154", "155", "030"], members, startedAt: 0, seed: "test" });

/** Answers until the subregion changes; `know` decides correctness per question. */
function run(state: PlacementState, know: (entity: string, kind: string) => boolean, t = 1000) {
  const asked: string[] = [];
  const subregion = state.order[state.index];
  let s = state;
  while (!s.done && s.order[s.index] === subregion) {
    const q = currentQuestion(s);
    if (!q) break;
    asked.push(`${q.kind}:${q.entityId}`);
    s = answerPlacement(s, know(q.entityId, q.kind), t);
  }
  return { state: s, asked };
}

describe("placement", () => {
  it("starts with two probe questions from the home subregion", () => {
    const s = start();
    expect(s.queue).toHaveLength(2);
    expect(s.queue.every((q) => q.kind === "probe" && q.subregion === "154")).toBe(true);
    expect(currentQuestion(s)?.cardId).toMatch(/:map_to_name$/);
  });

  it("tests every country, then capitals and flags of correct ones, when both probes are right", () => {
    const initial = start();
    const { state, asked } = run(initial, (id) => id !== "DNK");
    const countries = asked
      .filter((a) => a.startsWith("probe") || a.startsWith("country"))
      .map((a) => a.split(":")[1]);
    expect(countries.sort()).toEqual(["DNK", "FIN", "NOR", "SWE"]);
    const capitals = asked.filter((a) => a.startsWith("capital")).map((a) => a.split(":")[1]);
    const flags = asked.filter((a) => a.startsWith("flag")).map((a) => a.split(":")[1]);
    expect(capitals.sort()).toEqual(["FIN", "NOR", "SWE"]);
    expect(flags.sort()).toEqual(["FIN", "NOR", "SWE"]);
    expect(state.outcomes["154"]).toBe(initial.probes.includes("DNK") ? "partial" : "known");
    expect(state.order[state.index]).toBe("155");
  });

  it("marks a subregion unknown and moves on when both probes are wrong", () => {
    const { state, asked } = run(start(), () => false);
    expect(asked).toHaveLength(2);
    expect(state.outcomes["154"]).toBe("unknown");
    expect(currentQuestion(state)?.subregion).toBe("155");
  });

  it("tests the whole subregion when one probe is right", () => {
    const s = start();
    const firstProbe = s.queue[0]?.entityId;
    const { state, asked } = run(s, (id, kind) => kind === "probe" && id === firstProbe);
    expect(asked.filter((a) => a.startsWith("country"))).toHaveLength(2);
    expect(state.outcomes["154"]).toBe("partial");
  });

  it("can skip a subregion and finishes after the last one", () => {
    let s = skipSubregion(start());
    expect(s.outcomes["154"]).toBe("skipped");
    s = skipSubregion(skipSubregion(s));
    expect(s.done).toBe(true);
    expect(currentQuestion(s)).toBeNull();
  });

  it("stops at 120 questions or 15 minutes", () => {
    const big = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`s${i}`, ["A", "B", "C", "D"].map((x) => `${x}${i}`)]),
    );
    let s = startPlacement({ order: Object.keys(big), members: big, startedAt: 0, seed: "x" });
    let count = 0;
    while (!s.done) {
      s = answerPlacement(s, true, 1000);
      count++;
    }
    expect(count).toBe(PLACEMENT_MAX_QUESTIONS);
    const timed = answerPlacement(start(), true, 15 * 60_000);
    expect(timed.done).toBe(true);
  });

  it("seeds Good for correct answers and logs misses unscheduled", () => {
    expect(placementReview(true)).toEqual({ rating: 3, scheduled: true, mode: "placement" });
    expect(placementReview(false)).toEqual({ rating: 1, scheduled: false, mode: "placement" });
  });
});
