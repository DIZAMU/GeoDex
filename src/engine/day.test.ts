import { describe, expect, it } from "vitest";
import { learningDay } from "./day";

describe("learningDay", () => {
  it("starts at 04:00 local time", () => {
    const morning = new Date(2026, 5, 10, 9, 30).getTime();
    expect(learningDay(morning)).toEqual({
      start: new Date(2026, 5, 10, 4).getTime(),
      end: new Date(2026, 5, 11, 4).getTime(),
    });
  });

  it("counts 01:00 as part of the previous day", () => {
    const night = new Date(2026, 5, 11, 1).getTime();
    expect(learningDay(night).start).toBe(new Date(2026, 5, 10, 4).getTime());
  });

  it("honors a custom start hour", () => {
    expect(learningDay(new Date(2026, 5, 10, 5).getTime(), 6).start).toBe(
      new Date(2026, 5, 9, 6).getTime(),
    );
  });
});
