import { describe, expect, it } from "vitest";
import { eventsSince } from "./reset";

describe("eventsSince", () => {
  const events = [{ reviewedAt: 10 }, { reviewedAt: 20 }, { reviewedAt: 30 }];
  it("keeps every event when progress was never reset", () => {
    expect(eventsSince(events, null)).toHaveLength(3);
    expect(eventsSince(events, undefined)).toHaveLength(3);
  });
  it("keeps only events after the reset", () => {
    expect(eventsSince(events, 20)).toEqual([{ reviewedAt: 30 }]);
  });
  it("never changes the log it reads", () => {
    eventsSince(events, 25);
    expect(events).toHaveLength(3);
  });
});
