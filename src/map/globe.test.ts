import { describe, expect, it } from "vitest";
import {
  centerOn,
  clampZoom,
  degreesPerPixel,
  dragRotation,
  inertiaStep,
  MAX_TILT,
  MAX_ZOOM,
  normalize,
} from "./globe";

describe("globe rotation", () => {
  it("wraps longitude and clamps tilt", () => {
    expect(normalize({ lambda: 190, phi: 0 }).lambda).toBeCloseTo(-170);
    expect(normalize({ lambda: -190, phi: 0 }).lambda).toBeCloseTo(170);
    expect(normalize({ lambda: 0, phi: 120 }).phi).toBe(MAX_TILT);
    expect(normalize({ lambda: 0, phi: -120 }).phi).toBe(-MAX_TILT);
  });

  it("follows the pointer: half a circumference of drag turns half the globe", () => {
    const radius = 200;
    const r = dragRotation({ lambda: 0, phi: 0 }, Math.PI * radius, 0, radius);
    expect(Math.abs(r.lambda)).toBeCloseTo(180);
    expect(degreesPerPixel(radius) * Math.PI * radius).toBeCloseTo(180);
  });

  it("dragging down tilts the north toward the viewer", () => {
    expect(dragRotation({ lambda: 0, phi: 0 }, 0, 50, 200).phi).toBeLessThan(0);
  });

  it("centers a point", () => {
    expect(centerOn([10.75, 59.91])).toEqual({ lambda: -10.75, phi: -59.91 });
    expect(centerOn([10.75, 59.91], 35)).toEqual({ lambda: -10.75, phi: -35 });
  });

  it("clamps zoom", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(1000)).toBe(MAX_ZOOM);
  });
});

describe("inertia", () => {
  it("decays and stops", () => {
    let state: ReturnType<typeof inertiaStep> = {
      rotation: { lambda: 0, phi: 0 },
      velocity: { lambda: 3, phi: 0 },
    };
    let frames = 0;
    while (state && frames < 1000) {
      state = inertiaStep(state.rotation, state.velocity, 1);
      frames++;
    }
    expect(state).toBeNull();
    expect(frames).toBeGreaterThan(10);
    expect(frames).toBeLessThan(200);
  });

  it("moves in the direction of the velocity", () => {
    const next = inertiaStep({ lambda: 0, phi: 0 }, { lambda: 2, phi: -1 }, 1);
    expect(next?.rotation.lambda).toBeGreaterThan(0);
    expect(next?.rotation.phi).toBeLessThan(0);
  });
});
