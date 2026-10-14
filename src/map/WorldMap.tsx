/**
 * Equal Earth world map (PLAN.md 2, 8.2). SVG paths are projected once; zoom and fly-to
 * move a single transform. Labels and markers are drawn in screen space so they keep
 * their size at every zoom level.
 */
import { geoEqualEarth, geoGraticule10, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { type D3ZoomEvent, type ZoomBehavior, zoom, zoomIdentity } from "d3-zoom";
import type { Feature, Geometry } from "geojson";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Country } from "@/data/types";
import type { CountryTopology } from "@/data/world";
import {
  type Bounds,
  decimateRing,
  degreesPerPixel,
  fitTransform,
  MARKER_AREA_PX,
  MARKER_DOT_PX,
  MARKER_HIT_PX,
  MAX_ZOOM,
  pickCountry,
  screenArea,
  type Transform,
  unionBounds,
} from "./fit";

export type MapFocus = { kind: "world" } | { kind: "countries"; ids: readonly string[] };

export type MapHighlight = {
  /** Filled with the accent: the answer. */
  target?: string | null;
  /** Dashed outline and its own label: what the learner picked when wrong. */
  chosen?: string | null;
  /** Shown as selected before submitting. */
  selected?: string | null;
  /** Countries that get a name label. */
  labels?: readonly string[];
  /** Countries shaded as known (placement result, mastery views). */
  filled?: ReadonlySet<string>;
  /** Countries tinted lightly, such as the next region to learn. */
  tinted?: ReadonlySet<string>;
  /** Mastery level 0 (unseen) to 4 (mastered) per country, drawn with the theme's ramp. */
  levels?: ReadonlyMap<string, number>;
};

export type WorldMapProps = {
  countries: readonly Country[];
  topology: CountryTopology;
  focus: MapFocus;
  highlight?: MapHighlight;
  /** Countries that respond to clicks. Empty means the map is view-only. */
  selectable?: ReadonlySet<string>;
  onSelect?: (id: string) => void;
  labelFor: (id: string) => string;
  ariaLabel: string;
  /** Animate focus changes (the answer fly-to). Off for prompts. */
  animate?: boolean;
  /** Share of the viewport left as margin around the focus. Larger shows more context. */
  padding?: number;
  /** Pan and zoom with wheel, drag and pinch. Off for thumbnails inside scrolling pages. */
  interactive?: boolean;
  /**
   * Dragging sideways turns the globe instead of sliding the picture, so any longitude can
   * sit in the middle (the Pacific included). For world views such as the Atlas.
   */
  spin?: boolean;
};

/** Vertex step for the coarse geometry drawn while the globe turns. */
const SPIN_DECIMATE = 6;

function decimate(f: Feature<Geometry>): Feature<Geometry> {
  const g = f.geometry;
  if (g?.type === "Polygon") {
    return {
      ...f,
      geometry: { ...g, coordinates: g.coordinates.map((r) => decimateRing(r, SPIN_DECIMATE)) },
    };
  }
  if (g?.type === "MultiPolygon") {
    return {
      ...f,
      geometry: {
        ...g,
        coordinates: g.coordinates.map((p) => p.map((r) => decimateRing(r, SPIN_DECIMATE))),
      },
    };
  }
  return f;
}

/** bounds: the largest polygon only, so overseas parts and date-line wraps do not widen views. */
type Shape = { id: string; d: string; centroid: [number, number]; area: number; bounds: Bounds };

/** Bounds of the largest polygon of a feature. */
function mainBounds(f: Feature<Geometry>, path: ReturnType<typeof geoPath>): Bounds {
  if (f.geometry?.type !== "MultiPolygon") return path.bounds(f) as Bounds;
  let best: Feature<Geometry> = f;
  let bestArea = -1;
  for (const coordinates of f.geometry.coordinates) {
    const part: Feature<Geometry> = {
      type: "Feature",
      properties: null,
      geometry: { type: "Polygon", coordinates },
    };
    const area = path.area(part);
    if (area > bestArea) {
      best = part;
      bestArea = area;
    }
  }
  return path.bounds(best) as Bounds;
}

const FLY_MS = 600;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Playful gets a slightly springy ease; the other themes ease out. */
function themeEase(t: number): number {
  if (document.documentElement.dataset.theme === "playful") {
    const s = 1.4;
    const u = t - 1;
    return u * u * ((s + 1) * u + s) + 1;
  }
  return 1 - (1 - t) ** 3;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, ...size };
}

const Land = memo(function Land({
  shapes,
  outline,
  sphere,
  graticule,
  selectable,
}: {
  shapes: readonly Shape[];
  outline: string;
  sphere: string;
  graticule: string;
  selectable: ReadonlySet<string>;
}) {
  return (
    <>
      <path d={sphere} className="map-ocean" />
      <path d={graticule} className="map-graticule" />
      <path d={outline} className="map-land-other" />
      {shapes.map((shape) => (
        <path
          key={shape.id}
          d={shape.d}
          data-country={shape.id}
          className={selectable.has(shape.id) ? "map-country map-selectable" : "map-country"}
        />
      ))}
    </>
  );
});

export function WorldMap({
  countries,
  topology,
  focus,
  highlight = {},
  selectable = new Set(),
  onSelect,
  labelFor,
  ariaLabel,
  animate = false,
  padding = 0.12,
  interactive = true,
  spin = false,
}: WorldMapProps) {
  const { ref: containerRef, width, height } = useSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  const inScope = useMemo(() => new Set(countries.map((c) => c.id)), [countries]);
  /** Central longitude offset, in degrees, when the globe has been turned. */
  const [rotation, setRotation] = useState(0);
  const [turning, setTurning] = useState(false);

  const features = useMemo(() => {
    const topo = topology as unknown as Topology;
    const full = (
      feature(topo, topo.objects.countries as never) as unknown as { features: Feature<Geometry>[] }
    ).features;
    return { full, coarse: spin ? full.map(decimate) : full };
  }, [topology, spin]);

  const geometry = useMemo(() => {
    if (width === 0 || height === 0) return null;
    const collection = { features: turning ? features.coarse : features.full };
    const projection = geoEqualEarth()
      .rotate([rotation, 0])
      .fitExtent(
        [
          [8, 8],
          [width - 8, height - 8],
        ],
        { type: "Sphere" },
      );
    const path = geoPath(projection).digits(1);
    const shapes: Shape[] = [];
    const others: Feature<Geometry>[] = [];
    for (const f of collection.features) {
      const id = String(f.id ?? "");
      if (!inScope.has(id)) {
        others.push(f);
        continue;
      }
      const country = countries.find((c) => c.id === id);
      const centroid = country ? projection([country.centroid[0], country.centroid[1]]) : null;
      shapes.push({
        id,
        d: path(f) ?? "",
        centroid: centroid ?? (path.centroid(f) as [number, number]),
        area: path.area(f),
        bounds: mainBounds(f, path),
      });
    }
    // Countries drawn only as markers (no geometry), such as Tuvalu.
    const markerOnly = countries
      .filter((c) => c.markerOnly)
      .map((c) => {
        const point = projection([c.centroid[0], c.centroid[1]]) ?? [0, 0];
        return {
          id: c.id,
          d: "",
          centroid: point,
          area: 0,
          bounds: [
            [point[0] - 2, point[1] - 2],
            [point[0] + 2, point[1] + 2],
          ] as Bounds,
        };
      });
    const sphereBounds = path.bounds({ type: "Sphere" });
    return {
      shapes,
      markerOnly,
      byId: new Map([...shapes, ...markerOnly].map((s) => [s.id, s])),
      outline: path({ type: "FeatureCollection", features: others }) ?? "",
      sphere: path({ type: "Sphere" }) ?? "",
      graticule: path(geoGraticule10()) ?? "",
      sphereWidth: sphereBounds[1][0] - sphereBounds[0][0],
    };
  }, [features, countries, inScope, width, height, rotation, turning]);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const ready = geometry !== null;

  // Zoom behavior: wheel, drag and pinch, with the transform kept in React state per frame.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width === 0) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      // With spin, one-pointer drags turn the globe (below); zoom keeps wheel and pinch.
      .filter((event: Event) =>
        spin
          ? event.type === "wheel" || ((event as TouchEvent).touches?.length ?? 0) > 1
          : (!(event as MouseEvent).ctrlKey || event.type === "wheel") &&
            !(event as MouseEvent).button,
      )
      .scaleExtent([1, MAX_ZOOM])
      .translateExtent([
        [-width, -height],
        [width * 2, height * 2],
      ])
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const { k, x, y } = event.transform;
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => setTransform({ k, x, y }));
      });
    zoomRef.current = behavior;
    // A view-only map still uses the behavior to move, but listens to no input.
    if (interactive) select(svg).call(behavior).on("dblclick.zoom", null);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, [width, height, interactive, spin]);

  // Focus: fit the requested countries, animated only for the answer moment. The key is a
  // string so a new array with the same ids does not refit the map.
  const focusKey = focus.kind === "world" ? "" : focus.ids.join(",");
  useEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    const geometry = geometryRef.current;
    if (!svg || !behavior || !geometry || !ready) return;
    let target: Transform = { k: 1, x: 0, y: 0 };
    const ids = focusKey === "" ? [] : focusKey.split(",");
    // In views of several countries, very wide ones (Russia, Canada) are left out so a
    // region view stays on the region; their nearby parts show anyway.
    const wide = width * 0.35;
    const shapes = ids
      .map((id) => geometry.byId.get(id))
      .filter((s): s is Shape => s !== undefined);
    const narrow = shapes.filter((s) => s.bounds[1][0] - s.bounds[0][0] <= wide);
    const bounds = unionBounds(
      (shapes.length > 1 && narrow.length > 0 ? narrow : shapes).map((s) => s.bounds),
    );
    if (bounds) target = fitTransform(bounds, width, height, padding);
    const next = zoomIdentity.translate(target.x, target.y).scale(target.k);
    const selection = select(svg);
    if (animate && !prefersReducedMotion()) {
      selection.transition().duration(FLY_MS).ease(themeEase).call(behavior.transform, next);
    } else {
      selection.interrupt().call(behavior.transform, next);
    }
  }, [focusKey, ready, width, height, animate, padding]);

  const toScreen = (point: [number, number]): [number, number] => [
    point[0] * transform.k + transform.x,
    point[1] * transform.k + transform.y,
  ];

  // Sideways drags turn the globe; up and down pans. Applied once per frame.
  const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);
  const pending = useRef({ dx: 0, dy: 0, frame: 0 });
  const suppressClick = useRef(false);
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!spin || !interactive) return;
    // A second finger means a pinch: zoom takes over and the turn stops.
    if (!event.isPrimary) {
      drag.current = null;
      return;
    }
    if (event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    const svg = svgRef.current;
    if (!d || d.id !== event.pointerId || !svg) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    d.x = event.clientX;
    d.y = event.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    if (d.moved < 4) return;
    if (!turning) {
      svg.setPointerCapture(event.pointerId);
      setTurning(true);
    }
    pending.current.dx += dx;
    pending.current.dy += dy;
    if (pending.current.frame) return;
    pending.current.frame = requestAnimationFrame(() => {
      const { dx: px, dy: py } = pending.current;
      pending.current = { dx: 0, dy: 0, frame: 0 };
      const g = geometryRef.current;
      const behavior = zoomRef.current;
      if (!g || !behavior) return;
      const k = transformRef.current.k;
      setRotation((r) => ((r + px * degreesPerPixel(g.sphereWidth, k) + 540) % 360) - 180);
      if (py !== 0) behavior.translateBy(select(svg), 0, py / k);
    });
  };
  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (d.moved >= 4) {
      suppressClick.current = true;
      setTurning(false);
    }
  };
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const point: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
      // The country shape under the pointer, looking through marker tap targets above it.
      const under = document
        .elementsFromPoint(event.clientX, event.clientY)
        .find((el) => el.classList.contains("map-country"))
        ?.getAttribute("data-country");
      const shapeId = under && selectable.has(under) ? under : null;
      const targets = [...svg.querySelectorAll<SVGGElement>("g[data-marker]")]
        .map((el) => ({
          id: el.dataset.country ?? "",
          x: Number(el.dataset.x),
          y: Number(el.dataset.y),
        }))
        .filter((m) => selectable.has(m.id));
      const id = pickCountry(point, targets, shapeId);
      if (id) onSelect?.(id);
    },
    [selectable, onSelect],
  );

  const markers = geometry
    ? [...geometry.shapes, ...geometry.markerOnly].filter(
        (s) =>
          (s.d === "" || screenArea(s.area, transform.k) < MARKER_AREA_PX) &&
          (selectable.has(s.id) ||
            s.id === highlight.target ||
            s.id === highlight.chosen ||
            s.id === highlight.selected),
      )
    : [];
  const labels = [
    ...new Set([...(highlight.labels ?? []), highlight.chosen].filter(Boolean) as string[]),
  ];

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[var(--map-ocean)]"
      data-interactive={interactive}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: map picks have a keyboard alternative in the answer panel */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="world-map block touch-none select-none"
        data-turning={turning || undefined}
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {geometry && (
          <>
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              <Land
                shapes={geometry.shapes}
                outline={geometry.outline}
                sphere={geometry.sphere}
                graticule={geometry.graticule}
                selectable={selectable}
              />
              {[...(highlight.levels ?? [])].map(([id, level]) =>
                geometry.byId.get(id)?.d ? (
                  <path
                    key={`level-${id}`}
                    d={geometry.byId.get(id)?.d}
                    className={`map-level map-level-${level}`}
                    data-level={level}
                  />
                ) : null,
              )}
              {[...(highlight.tinted ?? [])].map((id) =>
                geometry.byId.get(id)?.d ? (
                  <path key={`tint-${id}`} d={geometry.byId.get(id)?.d} className="map-tinted" />
                ) : null,
              )}
              {[...(highlight.filled ?? [])].map((id) =>
                geometry.byId.get(id)?.d ? (
                  <path key={`fill-${id}`} d={geometry.byId.get(id)?.d} className="map-filled" />
                ) : null,
              )}
              {highlight.selected && geometry.byId.get(highlight.selected)?.d ? (
                <path
                  d={geometry.byId.get(highlight.selected)?.d}
                  className="map-selected"
                  data-testid="map-selected"
                />
              ) : null}
              {highlight.target && geometry.byId.get(highlight.target)?.d ? (
                <path
                  d={geometry.byId.get(highlight.target)?.d}
                  className="map-target"
                  data-testid="map-target"
                />
              ) : null}
              {highlight.chosen && geometry.byId.get(highlight.chosen)?.d ? (
                <path
                  d={geometry.byId.get(highlight.chosen)?.d}
                  className="map-chosen"
                  data-testid="map-chosen"
                />
              ) : null}
            </g>
            <g>
              {markers.map((m) => {
                const [x, y] = toScreen(m.centroid);
                const state =
                  m.id === highlight.target
                    ? "map-marker-target"
                    : m.id === highlight.chosen
                      ? "map-marker-chosen"
                      : m.id === highlight.selected
                        ? "map-marker-selected"
                        : "";
                const level = highlight.levels?.get(m.id);
                return (
                  <g
                    key={m.id}
                    data-country={m.id}
                    data-marker
                    data-x={x}
                    data-y={y}
                    transform={`translate(${x},${y})`}
                  >
                    {selectable.has(m.id) ? (
                      <circle r={MARKER_HIT_PX} className="map-marker-hit" />
                    ) : null}
                    <circle
                      r={MARKER_DOT_PX}
                      className={`map-marker ${state}`}
                      style={
                        state === "" && level !== undefined
                          ? { fill: `var(--mastery-${level})` }
                          : undefined
                      }
                    />
                  </g>
                );
              })}
              {labels.map((id) => {
                const shape = geometry.byId.get(id);
                if (!shape) return null;
                const [x, y] = toScreen(shape.centroid);
                return (
                  <text
                    key={id}
                    x={x}
                    y={y}
                    className={id === highlight.chosen ? "map-label map-label-chosen" : "map-label"}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {labelFor(id)}
                  </text>
                );
              })}
            </g>
          </>
        )}
      </svg>
      {/* Edge shading gives the map depth; it never takes clicks. */}
      <div aria-hidden className="map-vignette pointer-events-none absolute inset-0" />
    </div>
  );
}
