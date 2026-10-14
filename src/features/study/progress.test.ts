import { describe, expect, it } from "vitest";
import type { CardPhase, CardState } from "@/engine/scheduler";
import { cardLevel, countryLevel } from "./progress";

function state(cardId: string, phase: CardPhase, stability = 0): [string, CardState] {
  return [
    cardId,
    {
      cardId,
      phase,
      due: 0,
      stability,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 1,
      lapses: 0,
      lastReview: 0,
    },
  ];
}

describe("cardLevel", () => {
  it("maps phase and stability to levels 0 to 4", () => {
    expect(cardLevel(undefined)).toBe(0);
    expect(cardLevel(state("A:map_to_name", "new")[1])).toBe(0);
    expect(cardLevel(state("A:map_to_name", "learning")[1])).toBe(1);
    expect(cardLevel(state("A:map_to_name", "review", 3)[1])).toBe(2);
    expect(cardLevel(state("A:map_to_name", "review", 10)[1])).toBe(3);
    expect(cardLevel(state("A:map_to_name", "review", 30)[1])).toBe(4);
  });
});

describe("countryLevel", () => {
  it("is not started when no card of the skill is started", () => {
    expect(countryLevel(new Map(), "NOR", "capitals")).toBe(0);
  });

  it("shows learning once one direction is started", () => {
    const states = new Map([state("NOR:country_to_capital", "review", 30)]);
    expect(countryLevel(states, "NOR", "capitals")).toBe(1);
  });

  it("takes the weaker direction once both are started", () => {
    const states = new Map([
      state("NOR:country_to_capital", "review", 30),
      state("NOR:capital_to_country", "review", 10),
    ]);
    expect(countryLevel(states, "NOR", "capitals")).toBe(3);
  });

  it("ignores cards of other skills", () => {
    const states = new Map([state("NOR:flag_to_name", "review", 30)]);
    expect(countryLevel(states, "NOR", "location")).toBe(0);
  });
});
