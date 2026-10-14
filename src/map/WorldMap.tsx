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
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Country, HistoricalEntity, PhysicalFeature } from "@/data/types";
import type { CountryTopology } from "@/data/world";
import {
  type Bounds,
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
import { useSize } from "./useSize";

export type MapFocus =
  | { kind: "world" }
  | { kind: "countries"; ids: readonly string[] }
  /** [west, south, east, north] in degrees, such as the area around a lake. */
  | { kind: "box"; box: readonly [number, number, number, number] };

/** One country, or several (the members of a group). */
type Ids = string | readonly string[] | null;

const idSet = (ids: Ids | undefined): Set<string> =>
  new Set(ids == null ? [] : typeof ids === "string" ? [ids] : ids);

export type MapHighlight = {
  /** Filled with the accent: the answer. */
  target?: Ids;
  /** Dashed outline and its own label: what the learner picked when wrong. */
  chosen?: Ids;
  /** Shown as selected before submitting. */
  selected?: Ids;
  /** Countries that get a name label. */
  labels?: readonly string[];
  /** Countries shaded as known (placement result, mastery views). */
  filled?: ReadonlySet<string>;
  /** Countries tinted lightly, such as the next region to learn. */
  tinted?: ReadonlySet<string>;
  /** Mastery level 0 (unseen) to 4 (mastered) per country, drawn with the theme's ramp. */
  levels?: ReadonlyMap<string, number>;
  /**
   * Points such as a city and the learner's pin, [lon, lat]. A pin and a target are joined
   * by a dashed line so the miss reads at a glance.
   */
  points?: readonly { at: [number, number]; kind: "target" | "pin"; label?: string }[];
};

export type WorldMapProps = {
  countries: readonly Country[];
  topology: CountryTopology;
  focus: MapFocus;
  highlight?: MapHighlight;
  /** Countries that respond to clicks. Empty means the map is view-only. */
  selectable?: ReadonlySet<string>;
  onSelect?: (id: string) => void;
  /** Pin answers: a tap anywhere reports its [lon, lat] instead of a country. */
  onPin?: (at: [number, number]) => void;
  labelFor: (id: string) => string;
  ariaLabel: string;
  /** Animate focus changes (the answer fly-to). Off for prompts. */
  animate?: boolean;
  /** Share of the viewport left as margin around the focus. Larger shows more context. */
  padding?: number;
  /** Pan and zoom with wheel, drag and pinch. Off for thumbnails inside scrolling pages. */
  interactive?: boolean;
  /**
   * Physical features to draw (oceans, seas, lakes, rivers, ranges, deserts). Highlights and
   * labels take their ids like country ids.
   */
  physical?: readonly PhysicalFeature[];
  /** Features that respond to taps. When set, a tap picks a feature, never a country. */
  selectableFeatures?: ReadonlySet<string>;
  /**
   * Dissolved states and empires to outline, clipped to land or to their countries.
   * Highlights and labels take their ids like country ids.
   */
  history?: readonly HistoricalEntity[];
  /** Drawn over the map's corner, such as the year an outline shows. */
  caption?: ReactNode;
};

type OutlineShape = { id: string; d: string; clip: string | null; label: [number, number] };

/** Draw order, bottom to top. Taps hit the topmost: rivers, then lakes, land, seas, oceans. */
const FEATURE_ORDER: PhysicalFeature["kind"][] = [
  "ocean",
  "sea",
  "desert",
  "mountain_range",
  "lake",
  "river",
];

type FeatureShape = {
  id: string;
  kind: PhysicalFeature["kind"];
  d: string;
  label: [number, number];
  /** Typical width of the shape at zoom 1 (2 x area / perimeter); 0 for rivers. */
  thickness: number;
};

/** Shapes thinner than this on screen get a tap dot, like small countries (PLAN.md 8.4). */
const FEATURE_DOT_BELOW_PX = 12;

const Features = memo(function Features({
  shapes,
  selectable,
  targets,
  chosen,
  selected,
}: {
  shapes: readonly FeatureShape[];
  selectable: ReadonlySet<string>;
  targets: ReadonlySet<string>;
  chosen: ReadonlySet<string>;
  selected: ReadonlySet<string>;
}) {
  return (
    <g className="map-features">
      {shapes.map((f) => {
        const state = targets.has(f.id)
          ? " map-feature-target"
          : chosen.has(f.id)
            ? " map-feature-chosen"
            : selected.has(f.id)
              ? " map-feature-selected"
              : "";
        const pick = selectable.has(f.id);
        return (
          <g key={f.id} data-kind={f.kind}>
            <path
              d={f.d}
              className={`map-feature map-feature-${f.kind}${state}${pick ? " map-selectable" : ""}`}
              data-feature={f.id}
              data-testid={state ? `feature${state.replace(" map-feature", "")}` : undefined}
            />
            {f.kind === "river" && pick ? (
              // Rivers are thin: a wide invisible stroke is their tap target (PLAN.md Phase 8).
              <path d={f.d} className="map-feature-hit" data-feature={f.id} />
            ) : null}
          </g>
        );
      })}
    </g>
  );
});

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
const EMPTY_SET: ReadonlySet<string> = new Set();

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
  onPin,
  labelFor,
  ariaLabel,
  animate = false,
  padding = 0.12,
  interactive = true,
  physical,
  selectableFeatures,
  history,
  caption,
}: WorldMapProps) {
  const { ref: containerRef, width, height } = useSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const frame = useRef<number | null>(null);

  const inScope = useMemo(() => new Set(countries.map((c) => c.id)), [countries]);
  const features = useMemo(() => {
    const topo = topology as unknown as Topology;
    return (
      feature(topo, topo.objects.countries as never) as unknown as { features: Feature<Geometry>[] }
    ).features;
  }, [topology]);

  const geometry = useMemo(() => {
    if (width === 0 || height === 0) return null;
    const collection = { features };
    const projection = geoEqualEarth().fitExtent(
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
    const featureShapes: FeatureShape[] = [...(physical ?? [])]
      .sort((a, b) => FEATURE_ORDER.indexOf(a.kind) - FEATURE_ORDER.indexOf(b.kind))
      .map((f) => {
        const geo = f.geometry as Geometry;
        const perimeter = f.geometry.type === "MultiPolygon" ? path.measure(geo) : 0;
        return {
          id: f.id,
          kind: f.kind,
          d: path(geo) ?? "",
          label: (projection(f.label) ?? [0, 0]) as [number, number],
          thickness: perimeter > 0 ? (2 * path.area(geo)) / perimeter : 0,
        };
      });
    const countryD = new Map(shapes.map((sh) => [sh.id, sh.d]));
    let land: string | null = null;
    const outlineShapes: OutlineShape[] = (history ?? []).flatMap((e) => {
      if (e.kind === "former_name") return [];
      const { clip } = e.outline;
      if (clip === "land" && land === null) {
        const topo = topology as unknown as Topology;
        land = path(feature(topo, topo.objects.land as never) as never) ?? "";
      }
      return [
        {
          id: e.id,
          d: path(e.outline.geometry as Geometry) ?? "",
          clip:
            clip === null
              ? null
              : clip === "land"
                ? land
                : clip.map((id) => countryD.get(id) ?? "").join(""),
          label: (projection(e.outline.label) ?? [0, 0]) as [number, number],
        },
      ];
    });
    return {
      projection,
      shapes,
      outlineShapes,
      outlineById: new Map(outlineShapes.map((o) => [o.id, o])),
      featureShapes,
      featureById: new Map(featureShapes.map((f) => [f.id, f])),
      markerOnly,
      byId: new Map([...shapes, ...markerOnly].map((s) => [s.id, s])),
      outline: path({ type: "FeatureCollection", features: others }) ?? "",
      sphere: path({ type: "Sphere" }) ?? "",
      graticule: path(geoGraticule10()) ?? "",
    };
  }, [features, countries, inScope, width, height, physical, history, topology]);
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const ready = geometry !== null;

  // Zoom behavior: wheel, drag and pinch, with the transform kept in React state per frame.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || width === 0) return;
    const behavior = zoom<SVGSVGElement, unknown>()
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
  }, [width, height, interactive]);

  // Focus: fit the requested countries, animated only for the answer moment. The key is a
  // string so a new array with the same ids does not refit the map.
  const focusKey =
    focus.kind === "world"
      ? ""
      : focus.kind === "box"
        ? `box:${focus.box.join(",")}`
        : focus.ids.join(",");
  useEffect(() => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    const geometry = geometryRef.current;
    if (!svg || !behavior || !geometry || !ready) return;
    let target: Transform = { k: 1, x: 0, y: 0 };
    if (focusKey.startsWith("box:")) {
      // Project a grid over the box: Equal Earth bends its edges, so corners are not enough.
      const [w, s, e, n] = focusKey.slice(4).split(",").map(Number) as [
        number,
        number,
        number,
        number,
      ];
      const points: [number, number][] = [];
      for (let i = 0; i <= 6; i++)
        for (let j = 0; j <= 6; j++) {
          const p = geometry.projection([w + ((e - w) * i) / 6, s + ((n - s) * j) / 6]);
          if (p) points.push(p as [number, number]);
        }
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      target = fitTransform(
        [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
        ],
        width,
        height,
        padding,
      );
      const next = zoomIdentity.translate(target.x, target.y).scale(target.k);
      const selection = select(svg);
      if (animate && !prefersReducedMotion()) {
        selection.transition().duration(FLY_MS).ease(themeEase).call(behavior.transform, next);
      } else {
        selection.interrupt().call(behavior.transform, next);
      }
      return;
    }
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

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const point: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
      if (onPin) {
        const g = geometryRef.current;
        const t = transformRef.current;
        const at = g?.projection.invert?.([(point[0] - t.x) / t.k, (point[1] - t.y) / t.k]);
        if (at && Number.isFinite(at[0]) && Number.isFinite(at[1])) onPin([at[0], at[1]]);
        return;
      }
      // Feature answers: the topmost tappable feature under the pointer, never a country.
      if (selectableFeatures && selectableFeatures.size > 0) {
        const hit = document
          .elementsFromPoint(event.clientX, event.clientY)
          .map((el) => el.getAttribute("data-feature"))
          .find((id): id is string => id !== null && selectableFeatures.has(id));
        if (hit) onSelect?.(hit);
        return;
      }
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
    [selectable, onSelect, onPin, selectableFeatures],
  );
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const targets = idSet(highlight.target);
  const chosen = idSet(highlight.chosen);
  const selected = idSet(highlight.selected);
  const markers = geometry
    ? [...geometry.shapes, ...geometry.markerOnly].filter(
        (s) =>
          (s.d === "" || screenArea(s.area, transform.k) < MARKER_AREA_PX) &&
          (selectable.has(s.id) || targets.has(s.id) || chosen.has(s.id) || selected.has(s.id)),
      )
    : [];
  const labels = [...new Set([...(highlight.labels ?? []), ...chosen])];

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
        className="world-map absolute inset-0 block touch-none select-none"
        data-pin={onPin ? "true" : undefined}
        onClick={handleClick}
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
              {geometry.outlineShapes.map((o) => {
                const state = targets.has(o.id)
                  ? "target"
                  : chosen.has(o.id)
                    ? "chosen"
                    : selected.has(o.id)
                      ? "selected"
                      : "plain";
                return (
                  <g key={`outline-${o.id}`}>
                    {o.clip !== null ? (
                      <clipPath id={`clip-${o.id}`}>
                        <path d={o.clip} />
                      </clipPath>
                    ) : null}
                    <path
                      d={o.d}
                      className={`map-outline map-outline-${state}`}
                      clipPath={o.clip !== null ? `url(#clip-${o.id})` : undefined}
                      data-testid="history-outline"
                      data-history={o.id}
                      data-state={state}
                    />
                  </g>
                );
              })}
              {geometry.featureShapes.length > 0 ? (
                <Features
                  shapes={geometry.featureShapes}
                  selectable={selectableFeatures ?? EMPTY_SET}
                  targets={targets}
                  chosen={chosen}
                  selected={selected}
                />
              ) : null}
              {[...selected].map((id) =>
                geometry.byId.get(id)?.d ? (
                  <path
                    key={`selected-${id}`}
                    d={geometry.byId.get(id)?.d}
                    className="map-selected"
                    data-testid="map-selected"
                    data-id={id}
                  />
                ) : null,
              )}
              {[...targets].map((id) =>
                geometry.byId.get(id)?.d ? (
                  <path
                    key={`target-${id}`}
                    d={geometry.byId.get(id)?.d}
                    className="map-target"
                    data-testid="map-target"
                    data-id={id}
                  />
                ) : null,
              )}
              {[...chosen].map((id) =>
                geometry.byId.get(id)?.d ? (
                  <path
                    key={`chosen-${id}`}
                    d={geometry.byId.get(id)?.d}
                    className="map-chosen"
                    data-testid="map-chosen"
                    data-id={id}
                  />
                ) : null,
              )}
            </g>
            <g>
              {geometry.featureShapes
                .filter(
                  (f) =>
                    f.thickness > 0 &&
                    f.thickness * transform.k < FEATURE_DOT_BELOW_PX &&
                    (selectableFeatures?.has(f.id) ||
                      targets.has(f.id) ||
                      chosen.has(f.id) ||
                      selected.has(f.id)),
                )
                .map((f) => {
                  const [x, y] = toScreen(f.label);
                  const state = targets.has(f.id)
                    ? " map-feature-dot-target"
                    : chosen.has(f.id)
                      ? " map-feature-dot-chosen"
                      : selected.has(f.id)
                        ? " map-feature-dot-selected"
                        : "";
                  return (
                    <g
                      key={`dot-${f.id}`}
                      transform={`translate(${x},${y})`}
                      data-feature-dot={f.id}
                    >
                      {selectableFeatures?.has(f.id) ? (
                        <circle r={MARKER_HIT_PX} className="map-marker-hit" data-feature={f.id} />
                      ) : null}
                      <circle r={MARKER_DOT_PX} className={`map-feature-dot${state}`} />
                    </g>
                  );
                })}
              {markers.map((m) => {
                const [x, y] = toScreen(m.centroid);
                const state = targets.has(m.id)
                  ? "map-marker-target"
                  : chosen.has(m.id)
                    ? "map-marker-chosen"
                    : selected.has(m.id)
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
              {(() => {
                const projected = (highlight.points ?? []).flatMap((p) => {
                  const xy = geometry.projection(p.at);
                  return xy ? [{ ...p, xy: toScreen(xy as [number, number]) }] : [];
                });
                const pin = projected.find((p) => p.kind === "pin");
                const target = projected.find((p) => p.kind === "target");
                return (
                  <g data-testid="map-points">
                    {pin && target ? (
                      <line
                        x1={pin.xy[0]}
                        y1={pin.xy[1]}
                        x2={target.xy[0]}
                        y2={target.xy[1]}
                        className="map-pin-line"
                      />
                    ) : null}
                    {projected.map((p) => (
                      <g
                        key={`${p.kind}-${p.at.join(",")}`}
                        transform={`translate(${p.xy[0]},${p.xy[1]})`}
                        data-point={p.kind}
                      >
                        <circle
                          r={p.kind === "target" ? 7 : 6}
                          className={`map-point map-point-${p.kind}`}
                        />
                        {p.label ? (
                          // Target labels sit above the dot, pin labels below, so two
                          // close points (Canberra and Sydney) never cover each other.
                          <text
                            y={p.kind === "target" ? -14 : 22}
                            className="map-label"
                            textAnchor="middle"
                          >
                            {p.label}
                          </text>
                        ) : null}
                      </g>
                    ))}
                  </g>
                );
              })()}
              {labels.map((id) => {
                const outline = geometry.outlineById.get(id);
                if (outline) {
                  const [x, y] = toScreen(outline.label);
                  return (
                    <text
                      key={id}
                      x={x}
                      y={y}
                      className={`map-label map-label-outline${chosen.has(id) ? " map-label-chosen" : ""}`}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {labelFor(id)}
                    </text>
                  );
                }
                const feature = geometry.featureById.get(id);
                if (feature) {
                  const [x, y] = toScreen(feature.label);
                  return (
                    <text
                      key={id}
                      x={x}
                      y={y}
                      className={`map-label map-label-feature${chosen.has(id) ? " map-label-chosen" : ""}`}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {labelFor(id)}
                    </text>
                  );
                }
                const shape = geometry.byId.get(id);
                if (!shape) return null;
                const [x, y] = toScreen(shape.centroid);
                return (
                  <text
                    key={id}
                    x={x}
                    y={y}
                    className={chosen.has(id) ? "map-label map-label-chosen" : "map-label"}
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
      {caption}
    </div>
  );
}
