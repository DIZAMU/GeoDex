/**
 * Orthographic globe on a canvas (PLAN.md 8.3 Atlas). Drag turns it in any direction with
 * inertia, wheel and pinch zoom, a tap opens a country. While it moves it draws a lighter
 * geometry; at rest it redraws in full detail. Colors come from the theme's CSS tokens.
 */
import { geoArea, geoBounds, geoContains, geoGraticule10 } from "d3-geo";
import type { Feature, Geometry, Position } from "geojson";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Country } from "@/data/types";
import type { CountryTopology } from "@/data/world";
import { MARKER_AREA_PX, pickCountry, simplifyRing } from "./fit";
import { centerOn, clampZoom, dragRotation, inertiaStep, normalize, type Rotation } from "./globe";
import {
  type Basis,
  basisFacing,
  invert,
  type PackedRing,
  packRing,
  packRingWithCap,
  projectPacked,
  ringVisible,
  toVec,
  type Vec3,
} from "./orthographic";
import { useSize } from "./useSize";

export type GlobeMapProps = {
  countries: readonly Country[];
  topology: CountryTopology;
  /** Mastery level 0 to 4 per country, drawn with the theme's ramp. */
  levels?: ReadonlyMap<string, number>;
  selectable?: ReadonlySet<string>;
  onSelect?: (id: string) => void;
  labelFor: (id: string) => string;
  ariaLabel: string;
  /** [lon, lat] the globe faces first, such as the home country. */
  initialCenter?: readonly [number, number];
  /** Turns the globe slowly on its own, in degrees a second, while nobody touches it. */
  autoRotate?: number;
  /** Illustration only: no small-country dots, no hover, no taps. */
  decorative?: boolean;
};

type Shape = {
  id: string;
  feature: Feature<Geometry>;
  /** Every ring as packed unit vectors at three levels of detail (see LOD_TOLERANCE). */
  lods: [PackedRing[], PackedRing[], PackedRing[]];
  /** Steradians: on screen at zoom 1 the shape covers about area * radius^2 pixels. */
  area: number;
  bounds: [[number, number], [number, number]];
  centroid: Vec3;
};

/**
 * Levels of detail, as simplification tolerances in degrees: coarse while moving, medium at
 * rest when zoomed out, full when zoomed in. One degree is about 7 px on a 400 px globe.
 */
const LOD_TOLERANCE = [0.3, 0.08, 0] as const;
/** The first view tilts at most this far, so a northern home country still shows its continent. */
const FIRST_VIEW_TILT = 35;
/** Rings smaller than this many pixels across are not drawn. */
const MIN_RING_PX = 0.8;

/** Which detail level suits a globe of radius r pixels, moving or at rest. */
function lodFor(r: number, moving: boolean): 0 | 1 | 2 {
  if (moving) return r < 1400 ? 0 : 1;
  return r < 1000 ? 1 : 2;
}
/** Full detail returns this long after the last movement. */
const SETTLE_MS = 140;
/** Movement past this many pixels makes a press a drag, not a tap. */
const TAP_SLOP = 5;

function ringsOf(geometry: Geometry | null): Position[][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

/**
 * Appends a projected ring. Points on the far side ride the rim as an arc, so shapes that
 * wrap behind the globe stay closed and never cut across it. Border segments are drawn only
 * between near-side points.
 */
function addRing(
  fill: Path2D,
  border: Path2D | null,
  ring: PackedRing,
  basis: Basis,
  r: number,
  cx: number,
  cy: number,
): void {
  if (!ringVisible(ring, basis, r, MIN_RING_PX)) return;
  const packed = ring.points;
  const n = packed.length / 3;
  if (n < 2) return;
  const p = { x: 0, y: 0, depth: 0 };
  let near = false;
  for (let i = 0; i < n; i++) {
    projectPacked(packed, i, basis, r, cx, cy, p);
    if (p.depth >= 0) {
      near = true;
      break;
    }
  }
  if (!near) return;
  let px = 0;
  let py = 0;
  let pd = 0;
  for (let i = 0; i < n; i++) {
    projectPacked(packed, i, basis, r, cx, cy, p);
    if (i === 0) {
      fill.moveTo(p.x, p.y);
      border?.moveTo(p.x, p.y);
    } else if (pd < 0 && p.depth < 0) {
      const a0 = Math.atan2(py - cy, px - cx);
      const a1 = Math.atan2(p.y - cy, p.x - cx);
      let delta = a1 - a0;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      fill.arc(cx, cy, r, a0, a1, delta < 0);
    } else {
      fill.lineTo(p.x, p.y);
      if (border) {
        if (pd >= 0 && p.depth >= 0) border.lineTo(p.x, p.y);
        else border.moveTo(p.x, p.y);
      }
    }
    px = p.x;
    py = p.y;
    pd = p.depth;
  }
  fill.closePath();
}

type Palette = {
  ocean: string;
  land: string;
  other: string;
  border: string;
  graticule: string;
  shade: string;
  foreground: string;
  primary: string;
  levels: string[];
};

function readPalette(element: Element): Palette {
  const style = getComputedStyle(element);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    ocean: v("--map-ocean", "#0e2433"),
    land: v("--map-land", "#1e4359"),
    other: v("--map-land", "#1e4359"),
    border: v("--map-border", "#7fa3b8"),
    graticule: v("--map-graticule", "rgb(127 163 184 / 0.12)"),
    shade: v("--map-shade", "rgb(4 14 22 / 0.55)"),
    foreground: v("--foreground", "#ffffff"),
    primary: v("--primary", "#f4b740"),
    levels: [0, 1, 2, 3, 4].map((n) => v(`--mastery-${n}`, "#888888")),
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function GlobeMap({
  countries,
  topology,
  levels,
  selectable,
  onSelect,
  labelFor,
  ariaLabel,
  initialCenter,
  autoRotate,
  decorative = false,
}: GlobeMapProps) {
  const { ref: containerRef, width, height } = useSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({
    rotation: initialCenter ? centerOn(initialCenter, FIRST_VIEW_TILT) : { lambda: -10, phi: -25 },
    k: 1,
    moving: false,
  });
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const hoverRef = useRef<string | null>(null);
  const palette = useRef<Palette | null>(null);
  const markers = useRef<{ id: string; x: number; y: number }[]>([]);
  const frame = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scoped = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const { shapes, others, graticule } = useMemo(() => {
    const topo = topology as unknown as Topology;
    const all = (
      feature(topo, topo.objects.countries as never) as unknown as { features: Feature<Geometry>[] }
    ).features;
    const list: Shape[] = [];
    const rest: [PackedRing[], PackedRing[], PackedRing[]] = [[], [], []];
    const lodsOf = (rings: Position[][]): Shape["lods"] => [
      rings.map((ring) => packRingWithCap(simplifyRing(ring, LOD_TOLERANCE[0]))),
      rings.map((ring) => packRingWithCap(simplifyRing(ring, LOD_TOLERANCE[1]))),
      rings.map((ring) => packRingWithCap(ring)),
    ];
    for (const f of all) {
      const id = String(f.id ?? "");
      const country = scoped.get(id);
      const rings = ringsOf(f.geometry);
      if (!country) {
        const lods = lodsOf(rings);
        for (const level of [0, 1, 2] as const) rest[level].push(...lods[level]);
        continue;
      }
      list.push({
        id,
        feature: f,
        lods: lodsOf(rings),
        area: geoArea(f),
        bounds: geoBounds(f) as Shape["bounds"],
        centroid: toVec(country.centroid),
      });
    }
    // Countries drawn only as points (Tuvalu): markers with no shape.
    for (const c of countries) {
      if (!c.markerOnly || list.some((s) => s.id === c.id)) continue;
      list.push({
        id: c.id,
        feature: {
          type: "Feature",
          properties: null,
          geometry: { type: "Point", coordinates: c.centroid },
        },
        lods: [[], [], []],
        area: 0,
        bounds: [c.centroid, c.centroid] as Shape["bounds"],
        centroid: toVec(c.centroid),
      });
    }
    const lines = geoGraticule10().coordinates.map((line) => packRing(line));
    return { shapes: list, others: rest, graticule: lines };
  }, [topology, scoped, countries]);

  const radius = Math.max(10, Math.min(width, height) / 2 - 12);

  /** Screen geometry for the current view. */
  const frameOf = useCallback(() => {
    const { rotation, k } = view.current;
    return {
      basis: basisFacing(-rotation.lambda, -rotation.phi),
      r: radius * k,
      cx: width / 2,
      cy: height / 2,
    };
  }, [radius, width, height]);

  const draw = useCallback(() => {
    frame.current = 0;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || width === 0) return;
    palette.current ??= readPalette(container);
    const colors = palette.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const { k, moving, rotation } = view.current;
    const { basis, r, cx, cy } = frameOf();

    // Soft halo around the globe.
    const halo = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.08);
    halo.addColorStop(0, colors.graticule);
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.ocean;
    ctx.fill();

    // Graticule: only segments on the near side.
    const grid = new Path2D();
    const p = { x: 0, y: 0, depth: 0 };
    for (const line of graticule) {
      let pen = false;
      for (let i = 0; i < line.length / 3; i++) {
        projectPacked(line, i, basis, r, cx, cy, p);
        if (p.depth < 0) pen = false;
        else if (pen) grid.lineTo(p.x, p.y);
        else {
          grid.moveTo(p.x, p.y);
          pen = true;
        }
      }
    }
    ctx.strokeStyle = colors.graticule;
    ctx.lineWidth = 0.6;
    ctx.stroke(grid);

    const borders = new Path2D();
    const otherFill = new Path2D();
    const lod = lodFor(r, moving);
    for (const ring of others[lod]) addRing(otherFill, borders, ring, basis, r, cx, cy);
    // Land outside the study scope (Greenland, Antarctica) recedes, as on the flat map.
    ctx.fillStyle = colors.other;
    ctx.globalAlpha = 0.55;
    ctx.fill(otherFill, "evenodd");
    ctx.globalAlpha = 1;

    const byLevel = new Map<number, Path2D>();
    for (const s of shapes) {
      if (s.area === 0) continue;
      const level = levels?.get(s.id) ?? -1;
      const group = byLevel.get(level) ?? new Path2D();
      for (const ring of s.lods[lod]) addRing(group, borders, ring, basis, r, cx, cy);
      byLevel.set(level, group);
    }
    for (const [level, group] of byLevel) {
      ctx.fillStyle = level >= 0 ? (colors.levels[level] ?? colors.land) : colors.land;
      ctx.fill(group, "evenodd");
    }
    ctx.strokeStyle = colors.border;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.6;
    ctx.stroke(borders);
    ctx.globalAlpha = 1;

    const hovered = hoverRef.current ? shapes.find((s) => s.id === hoverRef.current) : null;
    if (hovered && hovered.area > 0) {
      const outline = new Path2D();
      const discard = new Path2D();
      for (const ring of hovered.lods[lod]) addRing(discard, outline, ring, basis, r, cx, cy);
      ctx.strokeStyle = colors.foreground;
      ctx.lineWidth = 1.6;
      ctx.stroke(outline);
    }

    // Small countries get a dot, on the near side only.
    const next: { id: string; x: number; y: number }[] = [];
    for (const s of decorative ? [] : shapes) {
      if (s.area * r * r >= MARKER_AREA_PX) continue;
      projectPacked(new Float64Array(s.centroid), 0, basis, r, cx, cy, p);
      if (p.depth < 0.02) continue;
      next.push({ id: s.id, x: p.x, y: p.y });
      const level = levels?.get(s.id);
      ctx.beginPath();
      // Dots scale down on small globes, where many countries need one.
      const dot = Math.max(2.5, Math.min(4.5, r / 70));
      ctx.arc(p.x, p.y, s.id === hoverRef.current ? dot + 1.5 : dot, 0, Math.PI * 2);
      ctx.fillStyle = level !== undefined ? (colors.levels[level] ?? colors.land) : colors.land;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = s.id === hoverRef.current ? colors.foreground : colors.border;
      ctx.stroke();
    }
    markers.current = next;

    // Shading toward the rim gives the sphere depth.
    const shade = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.2, cx, cy, r);
    shade.addColorStop(0, "transparent");
    shade.addColorStop(0.75, "transparent");
    shade.addColorStop(1, colors.shade);
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    container.dataset.lambda = rotation.lambda.toFixed(2);
    container.dataset.phi = rotation.phi.toFixed(2);
    container.dataset.zoom = k.toFixed(2);
  }, [width, height, frameOf, shapes, others, graticule, levels, containerRef, decorative]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  /** Marks the globe as moving (coarse drawing) until it has been still for a moment. */
  const touch = useCallback(() => {
    view.current.moving = true;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      view.current.moving = false;
      schedule();
    }, SETTLE_MS);
    schedule();
  }, [schedule]);

  // Canvas size follows the container, at device resolution.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    schedule();
  }, [width, height, schedule]);

  useEffect(() => {
    schedule();
  }, [schedule]);

  // Theme changes swap the palette.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      palette.current = null;
      schedule();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, [schedule]);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  /** The country at a screen point: a marker's dot, the shape under it, then a near marker. */
  const pick = useCallback(
    (x: number, y: number): string | null => {
      if (decorative) return null;
      const { basis, r, cx, cy } = frameOf();
      const lonLat = invert(x, y, basis, r, cx, cy);
      let shapeId: string | null = null;
      if (lonLat) {
        for (const s of shapes) {
          if (s.area === 0) continue;
          const [[w, south], [e, north]] = s.bounds;
          if (lonLat[1] < south || lonLat[1] > north) continue;
          if (w <= e && (lonLat[0] < w || lonLat[0] > e)) continue;
          if (geoContains(s.feature, lonLat)) {
            shapeId = s.id;
            break;
          }
        }
      }
      const id = pickCountry([x, y], markers.current, shapeId);
      return id && (!selectable || selectable.has(id)) ? id : null;
    },
    [frameOf, shapes, selectable, decorative],
  );

  // Pointer input: one pointer turns the globe, two pinch to zoom, a still press taps.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: Rotation;
    x: number;
    y: number;
    moved: number;
    startK: number;
    startDistance: number;
    velocity: { lambda: number; phi: number };
    last: { t: number; rotation: Rotation };
    /** Running average of the time between pointer moves, in ms. */
    interval: number;
  } | null>(null);
  const inertia = useRef(0);

  // Idle spin (the welcome page): pauses while a pointer is down or inertia runs, and never
  // runs with reduced motion.
  useEffect(() => {
    if (!autoRotate) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let id = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (pointers.current.size === 0 && !inertia.current) {
        const { rotation } = view.current;
        view.current.rotation = normalize({
          lambda: rotation.lambda + (autoRotate * dt) / 1000,
          phi: rotation.phi,
        });
        touch();
      }
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [autoRotate, touch]);

  const stopInertia = () => {
    if (inertia.current) cancelAnimationFrame(inertia.current);
    inertia.current = 0;
  };

  const local = (event: React.PointerEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    stopInertia();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, local(event));
    const points = [...pointers.current.values()];
    const [a, b] = points;
    gesture.current = {
      start: view.current.rotation,
      x: a?.x ?? 0,
      y: a?.y ?? 0,
      moved: points.length > 1 ? TAP_SLOP + 1 : 0,
      startK: view.current.k,
      startDistance: a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
      velocity: { lambda: 0, phi: 0 },
      last: { t: performance.now(), rotation: view.current.rotation },
      interval: 16,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = local(event);
    const g = gesture.current;
    if (!g || !pointers.current.has(event.pointerId)) {
      // Hover: name the country under a mouse pointer.
      if (event.pointerType !== "mouse") return;
      const id = pick(point.x, point.y);
      if (id !== hoverRef.current) {
        hoverRef.current = id;
        schedule();
      }
      setHover(id ? { id, x: point.x, y: point.y } : null);
      return;
    }
    pointers.current.set(event.pointerId, point);
    const points = [...pointers.current.values()];
    if (points.length >= 2 && g.startDistance > 0) {
      const [a, b] = points as [{ x: number; y: number }, { x: number; y: number }];
      view.current.k = clampZoom(g.startK * (Math.hypot(a.x - b.x, a.y - b.y) / g.startDistance));
      g.moved = TAP_SLOP + 1;
      touch();
      return;
    }
    const dx = point.x - g.x;
    const dy = point.y - g.y;
    g.moved = Math.max(g.moved, Math.hypot(dx, dy));
    if (g.moved <= TAP_SLOP) return;
    if (hoverRef.current) {
      hoverRef.current = null;
      setHover(null);
    }
    const next = dragRotation(g.start, dx, dy, radius * view.current.k);
    const now = performance.now();
    g.interval = g.interval * 0.7 + (now - g.last.t) * 0.3;
    const dt = Math.max(1, now - g.last.t) / 16.7;
    const dLambda = ((((next.lambda - g.last.rotation.lambda + 540) % 360) + 360) % 360) - 180;
    g.velocity = {
      lambda: dLambda / dt,
      phi: (next.phi - g.last.rotation.phi) / dt,
    };
    g.last = { t: now, rotation: next };
    view.current.rotation = next;
    touch();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    if (pointers.current.size > 0 || !g) return;
    gesture.current = null;
    if (g.moved <= TAP_SLOP) {
      const point = local(event);
      const id = pick(point.x, point.y);
      if (id) onSelect?.(id);
      return;
    }
    // A release right after moving (a flick) keeps the spin going and lets it slow down.
    // "Right after" follows the device's own pointer rate, so slow devices flick too.
    const recent = performance.now() - g.last.t < Math.max(80, g.interval * 1.5);
    if (!recent || prefersReducedMotion()) return;
    let state = { rotation: view.current.rotation, velocity: g.velocity };
    let previous = performance.now();
    const step = (now: number) => {
      const frames = Math.min(4, Math.max(0, (now - previous) / 16.7));
      previous = now;
      const next = inertiaStep(state.rotation, state.velocity, frames);
      if (!next) {
        inertia.current = 0;
        return;
      }
      state = next;
      view.current.rotation = next.rotation;
      touch();
      inertia.current = requestAnimationFrame(step);
    };
    inertia.current = requestAnimationFrame(step);
  };

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      view.current.k = clampZoom(view.current.k * Math.exp(-event.deltaY * 0.0015));
      touch();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [touch]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = 10 / view.current.k;
    const { lambda, phi } = view.current.rotation;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => (view.current.rotation = normalize({ lambda: lambda + step, phi })),
      ArrowRight: () => (view.current.rotation = normalize({ lambda: lambda - step, phi })),
      ArrowUp: () => (view.current.rotation = normalize({ lambda, phi: phi - step })),
      ArrowDown: () => (view.current.rotation = normalize({ lambda, phi: phi + step })),
      "+": () => (view.current.k = clampZoom(view.current.k * 1.25)),
      "=": () => (view.current.k = clampZoom(view.current.k * 1.25)),
      "-": () => (view.current.k = clampZoom(view.current.k / 1.25)),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    stopInertia();
    move();
    touch();
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" data-testid="globe">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        className="absolute inset-0 h-full w-full cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (gesture.current) return;
          hoverRef.current = null;
          setHover(null);
          schedule();
        }}
        onKeyDown={onKeyDown}
      />
      {hover ? (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2 py-1 text-sm text-popover-foreground shadow-[var(--elevation)]"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          {labelFor(hover.id)}
        </div>
      ) : null}
    </div>
  );
}
