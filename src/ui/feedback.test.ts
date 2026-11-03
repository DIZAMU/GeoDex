import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { feedback, resetFeedbackForTests, TONES, VIBRATIONS } from "./feedback";

const started: number[] = [];

class FakeContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn();
  createGain() {
    const param = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    return { gain: param, connect: (n: unknown) => n };
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 0 },
      connect: (n: unknown) => n,
      start: () => started.push(1),
      stop: vi.fn(),
    };
  }
}

beforeEach(() => {
  started.length = 0;
  resetFeedbackForTests();
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("navigator", { vibrate: vi.fn(() => true) });
});

afterEach(() => vi.unstubAllGlobals());

describe("answer feedback", () => {
  it("plays a tone and vibrates by default", () => {
    feedback("right", {});
    expect(started).toHaveLength(TONES.right.length);
    expect(navigator.vibrate).toHaveBeenCalledWith(VIBRATIONS.right);
  });

  it("respects each switch on its own", () => {
    feedback("wrong", { soundOn: false });
    expect(started).toHaveLength(0);
    expect(navigator.vibrate).toHaveBeenCalledWith(VIBRATIONS.wrong);
    vi.mocked(navigator.vibrate).mockClear();
    feedback("finish", { vibrationOn: false });
    expect(started).toHaveLength(TONES.finish.length);
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });

  it("does nothing where the browser has no audio or vibration", () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("navigator", {});
    expect(() => feedback("right", {})).not.toThrow();
    expect(started).toHaveLength(0);
  });

  it("keeps every tone short and quiet", () => {
    for (const notes of Object.values(TONES)) {
      for (const n of notes) {
        expect(n.gain).toBeLessThanOrEqual(0.08);
        expect(n.at + n.length).toBeLessThanOrEqual(0.45);
      }
    }
  });
});
