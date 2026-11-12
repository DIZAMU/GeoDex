/**
 * Orthographic globe on a canvas. Drag turns it in any direction with
 * inertia, wheel and pinch zoom, a tap opens a country. While it moves it draws a lighter
 * geometry; at rest it redraws in full detail. Colors come from the theme's CSS tokens.
 */
import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance, geoGraticule10 } from "d3-geo";
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
  /** Countries picked out in the accent color, such as the region learning moves to next. */
  tinted?: ReadonlySet<string>;
  /** Historical outlines drawn over the countries (the Atlas over time), each with a name. */
  outlines?: readonly GlobeOutline[];
  outlineLabel?: (id: string) => string;
  /** [lon, lat] to turn toward whenever it changes; one given at mount is the starting view. */
  turnTo?: readonly [number, number] | null;
  /**
   * Countries to turn to and zoom in on, smoothly, the shorter way round: a session answer.
   * Unlike turnTo, the first value is animated too.
   */
  focusIds?: readonly string[] | null;
  /** The answer in a session: filled with the accent and named. */
  answer?: ReadonlySet<string>;
  /** A wrong pick in a session: filled with the warning colour and named. */
  wrong?: ReadonlySet<string>;
  /** Points such as a city, drawn as dots with their names. */
  points?: readonly { at: readonly [number, number]; kind: "target" | "pin"; label?: string }[];
};

/** A historical outline: drawn as `coordinates`, clipped to land or to the listed countries. */
export type GlobeOutline = {
  id: string;
  /** MultiPolygon coordinates, as in HistoryOutline. */
  coordinates: [number, number][][][];
  clip: "land" | readonly string[] | null;
  label: readonly [number, number];
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
/** How long the globe takes to turn toward a new place. */
const TURN_MS = 800;
/** Turning to a session answer and zooming in on it takes a little longer. */
const FOCUS_MS = 1100;
/** The closest a session answer zooms in. */
const FOCUS_MAX_ZOOM = 8;
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

/** A country's largest polygon by area: the mainland of one with overseas parts. */
function mainPolygon(f: Feature<Geometry>): Feature<Geometry> {
  if (f.geometry?.type !== "MultiPolygon") return f;
  let best: Feature<Geometry> = f;
  let bestArea = -1;
  for (const coordinates of f.geometry.coordinates) {
    const part: Feature<Geometry> = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates },
    };
    const area = geoArea(part);
    if (area > bestArea) {
      bestArea = area;
      best = part;
    }
  }
  return best;
}

/** A shape's rings at the three levels of detail (see LOD_TOLERANCE). */
function lodsOfRings(rings: Position[][]): [PackedRing[], PackedRing[], PackedRing[]] {
  return [
    rings.map((ring) => packRingWithCap(simplifyRing(ring, LOD_TOLERANCE[0]))),
    rings.map((ring) => packRingWithCap(simplifyRing(ring, LOD_TOLERANCE[1]))),
    rings.map((ring) => packRingWithCap(ring)),
  ];
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
  background: string;
  primary: string;
  destructive: string;
  levels: string[];
  font: string;
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
    background: v("--background", "#000000"),
    primary: v("--primary", "#f4b740"),
    destructive: v("--destructive", "#e47c72"),
    levels: [0, 1, 2, 3, 4].map((n) => v(`--mastery-${n}`, "#888888")),
    font: style.fontFamily || "sans-serif",
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
  tinted,
  outlines,
  outlineLabel,
  turnTo,
  focusIds,
  answer,
  wrong,
  points,
}: GlobeMapProps) {
  const { ref: containerRef, width, height } = useSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({
    rotation:
      (turnTo ?? initialCenter)
        ? centerOn((turnTo ?? initialCenter) as readonly [number, number], FIRST_VIEW_TILT)
        : { lambda: -10, phi: -25 },
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
  const { shapes, others, graticule, ringsById } = useMemo(() => {
    const topo = topology as unknown as Topology;
    const all = (
      feature(topo, topo.objects.countries as never) as unknown as { features: Feature<Geometry>[] }
    ).features;
    const list: Shape[] = [];
    const rest: [PackedRing[], PackedRing[], PackedRing[]] = [[], [], []];
    // Every country's rings by id, in or out of scope: outlines are clipped to them.
    const byId = new Map<string, Shape["lods"]>();
    for (const f of all) {
      const id = String(f.id ?? "");
      const country = scoped.get(id);
      const rings = ringsOf(f.geometry);
      const lods = lodsOfRings(rings);
      byId.set(id, lods);
      if (!country) {
        for (const level of [0, 1, 2] as const) rest[level].push(...lods[level]);
        continue;
      }
      list.push({
        id,
        feature: f,
        lods,
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
    return { shapes: list, others: rest, graticule: lines, ringsById: byId };
  }, [topology, scoped, countries]);

  // Outlines, packed like the countries, with what each is clipped to.
  const packedOutlines = useMemo(() => {
    if (!outlines || outlines.length === 0) return [];
    let land: Shape["lods"] | null = null;
    const landRings = () => {
      if (land) return land;
      const topo = topology as unknown as Topology;
      const f = feature(topo, topo.objects.land as never) as unknown as
        | Feature<Geometry>
        | { features: Feature<Geometry>[] };
      const rings =
        "features" in f ? f.features.flatMap((x) => ringsOf(x.geometry)) : ringsOf(f.geometry);
      land = lodsOfRings(rings);
      return land;
    };
    return outlines.map((o) => ({
      id: o.id,
      lods: lodsOfRings(o.coordinates.flat()),
      clip:
        o.clip === null
          ? null
          : o.clip === "land"
            ? landRings()
            : (([0, 1, 2] as const).map((level) =>
                o.clip === null || o.clip === "land"
                  ? []
                  : o.clip.flatMap((id) => ringsById.get(id)?.[level] ?? []),
              ) as Shape["lods"]),
      label: toVec(o.label as [number, number]),
    }));
  }, [outlines, topology, ringsById]);

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

    // Tinted countries: a light accent fill with an accent edge, as on the flat map.
    if (tinted && tinted.size > 0) {
      const fill = new Path2D();
      const edge = new Path2D();
      for (const s of shapes) {
        if (s.area === 0 || !tinted.has(s.id)) continue;
        for (const ring of s.lods[lod]) addRing(fill, edge, ring, basis, r, cx, cy);
      }
      ctx.fillStyle = colors.primary;
      ctx.globalAlpha = 0.25;
      ctx.fill(fill, "evenodd");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 1.2;
      ctx.stroke(edge);
    }

    // A session answer: the right country in the accent, a wrong pick in the warning colour.
    const fillCountries = (ids: ReadonlySet<string> | undefined, color: string, alpha: number) => {
      if (!ids || ids.size === 0) return;
      const fill = new Path2D();
      const edge = new Path2D();
      for (const s of shapes) {
        if (s.area === 0 || !ids.has(s.id)) continue;
        for (const ring of s.lods[lod]) addRing(fill, edge, ring, basis, r, cx, cy);
      }
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill(fill, "evenodd");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.stroke(edge);
    };
    fillCountries(answer, colors.primary, 0.85);
    fillCountries(wrong, colors.destructive, 0.6);

    // Historical outlines, shaded and edged as on the flat map, inside land or their countries.
    for (const o of packedOutlines) {
      const fill = new Path2D();
      const edge = new Path2D();
      for (const ring of o.lods[lod]) addRing(fill, edge, ring, basis, r, cx, cy);
      ctx.save();
      if (o.clip) {
        const area = new Path2D();
        for (const ring of o.clip[lod]) addRing(area, null, ring, basis, r, cx, cy);
        ctx.clip(area, "evenodd");
      }
      ctx.fillStyle = colors.foreground;
      ctx.globalAlpha = 0.32;
      ctx.fill(fill, "evenodd");
      ctx.strokeStyle = colors.foreground;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.4;
      ctx.stroke(edge);
      ctx.restore();
    }

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

    // Outline names, on the near side only, with a halo so they read over any color.
    if (outlineLabel && packedOutlines.length > 0) {
      ctx.font = `500 13px ${colors.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (const o of packedOutlines) {
        projectPacked(new Float64Array(o.label), 0, basis, r, cx, cy, p);
        if (p.depth < 0.15) continue;
        const text = outlineLabel(o.id);
        ctx.lineWidth = 3;
        ctx.strokeStyle = colors.background;
        ctx.strokeText(text, p.x, p.y);
        ctx.fillStyle = colors.foreground;
        ctx.fillText(text, p.x, p.y);
      }
    }
    container.dataset.outlines = packedOutlines.map((o) => o.id).join(" ");

    // Names of the answer and a wrong pick, and points such as a city, on the near side.
    const named = [...(answer ?? []), ...(wrong ?? [])];
    if (named.length > 0 || (points && points.length > 0)) {
      ctx.font = `500 13px ${colors.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const write = (text: string, x: number, y: number) => {
        ctx.lineWidth = 3;
        ctx.strokeStyle = colors.background;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = colors.foreground;
        ctx.fillText(text, x, y);
      };
      for (const id of named) {
        const shape = shapes.find((s) => s.id === id);
        if (!shape) continue;
        projectPacked(new Float64Array(shape.centroid), 0, basis, r, cx, cy, p);
        if (p.depth < 0.15) continue;
        write(labelFor(id), p.x, p.y);
      }
      for (const m of points ?? []) {
        projectPacked(new Float64Array(toVec(m.at)), 0, basis, r, cx, cy, p);
        if (p.depth < 0.05) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = m.kind === "target" ? colors.primary : colors.destructive;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.background;
        ctx.stroke();
        if (m.label) write(m.label, p.x, p.y - 14);
      }
    }

    container.dataset.lambda = rotation.lambda.toFixed(2);
    container.dataset.phi = rotation.phi.toFixed(2);
    container.dataset.zoom = k.toFixed(2);
  }, [
    width,
    height,
    frameOf,
    shapes,
    others,
    graticule,
    levels,
    containerRef,
    decorative,
    tinted,
    packedOutlines,
    outlineLabel,
    answer,
    wrong,
    points,
    labelFor,
  ]);

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

  // A session answer: turn to the countries and zoom until they fill about half the globe.
  const focusKey = focusIds?.join(",") ?? "";
  const focusTarget = useMemo(() => {
    if (!focusKey) return null;
    const ids = new Set(focusKey.split(","));
    // Each country's largest piece of land, as on the flat map, so French Guiana or the
    // Caribbean Netherlands do not pull the view across an ocean.
    const mains = shapes.filter((s) => ids.has(s.id)).map((s) => mainPolygon(s.feature));
    if (mains.length === 0) return null;
    const center = geoCentroid({ type: "FeatureCollection", features: mains } as never) as [
      number,
      number,
    ];
    // The angular radius: the farthest corner of any of the countries' boxes from the centre.
    let reach = 0;
    for (const main of mains) {
      const [[w, so], [e, n]] = geoBounds(main as never);
      for (const corner of [
        [w, so],
        [w, n],
        [e, so],
        [e, n],
      ] as [number, number][])
        reach = Math.max(reach, geoDistance(center, corner));
    }
    // A region of angular radius a fills sin(a) of the globe's radius at zoom 1.
    const k = Math.min(FOCUS_MAX_ZOOM, Math.max(1, 0.55 / Math.max(Math.sin(reach), 0.02)));
    return { center, k };
  }, [focusKey, shapes]);

  // Turning toward a new place: the Atlas over time when the year changes, or a session
  // answer. A turnTo given at mount is the starting view; a press stops a turn in progress.
  const turning = useRef(0);
  const firstTurn = useRef(turnTo != null);
  const turnLon = focusTarget?.center[0] ?? turnTo?.[0];
  const turnLat = focusTarget?.center[1] ?? turnTo?.[1];
  const zoomTo = focusTarget?.k;
  useEffect(() => {
    if (turnLon === undefined || turnLat === undefined) return;
    if (firstTurn.current) {
      firstTurn.current = false;
      return;
    }
    const from = view.current.rotation;
    const fromK = view.current.k;
    // The opening view tilts at most FIRST_VIEW_TILT, so a far-north place sits above the
    // middle. A zoomed-in answer must sit in the middle, so it may tilt as far as needed.
    const target =
      zoomTo !== undefined
        ? centerOn([turnLon, turnLat])
        : centerOn([turnLon, turnLat], FIRST_VIEW_TILT);
    const dLambda = ((((target.lambda - from.lambda + 180) % 360) + 360) % 360) - 180;
    const dPhi = target.phi - from.phi;
    if (prefersReducedMotion()) {
      view.current.rotation = target;
      if (zoomTo !== undefined) view.current.k = zoomTo;
      touch();
      return;
    }
    const start = performance.now();
    const duration = zoomTo !== undefined ? FOCUS_MS : TURN_MS;
    const step = (now: number) => {
      const x = Math.min(1, (now - start) / duration);
      const e = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
      view.current.rotation = normalize({
        lambda: from.lambda + dLambda * e,
        phi: from.phi + dPhi * e,
      });
      // Zoom follows the turn, a little behind it, so the globe turns first and then closes in.
      if (zoomTo !== undefined) view.current.k = fromK + (zoomTo - fromK) * e ** 1.6;
      touch();
      turning.current = x < 1 ? requestAnimationFrame(step) : 0;
    };
    cancelAnimationFrame(turning.current);
    turning.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(turning.current);
  }, [turnLon, turnLat, zoomTo, touch]);

  const stopInertia = () => {
    cancelAnimationFrame(turning.current);
    turning.current = 0;
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
          className="floating pointer-events-none absolute z-10 px-2 py-1 text-sm"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          {labelFor(hover.id)}
        </div>
      ) : null}
    </div>
  );
}
