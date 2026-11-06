/**
 * Borders over time (PLAN.md Phase 9): the history outlines whose period includes the
 * chosen year, each with the year it shows, on the same globe as the Atlas. The globe turns
 * toward the largest outline when the year changes. A view, not a quiz (DECISIONS.md 037).
 */
import { geoArea } from "d3-geo";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Country, DissolvedState, Empire } from "@/data/types";
import type { WorldData } from "@/data/world";
import type { Locale } from "@/i18n/locales";
import { GlobeMap } from "@/map/GlobeMap";
import { formatPeriod, formatYear, nameOf } from "../session/parts";

type Outlined = DissolvedState | Empire;

export function outlinedEntities(world: WorldData): Outlined[] {
  return world.history.flatMap((e) => (e.kind === "former_name" ? [] : [e]));
}

/** Outlines whose period includes the year, oldest first. */
export function outlinesAt(entities: readonly Outlined[], year: number): Outlined[] {
  return entities
    .filter((e) => e.period[0] <= year && year <= e.period[1])
    .sort((a, b) => a.period[0] - b.period[0] || a.id.localeCompare(b.id));
}

export function Timeline({
  world,
  countries,
  locale,
  year,
  onYear,
}: {
  world: WorldData;
  countries: readonly Country[];
  locale: Locale;
  year: number;
  onYear: (year: number) => void;
}) {
  const { t } = useTranslation();
  const all = useMemo(() => outlinedEntities(world), [world]);
  const [min, max] = useMemo(
    () => [Math.min(...all.map((e) => e.period[0])), Math.max(...all.map((e) => e.period[1]))],
    [all],
  );
  const shown = useMemo(() => outlinesAt(all, year), [all, year]);
  const labelFor = useCallback((id: string) => nameOf(world, id, locale), [world, locale]);
  const outlines = useMemo(
    () =>
      shown.map((e) => ({
        id: e.id,
        coordinates: e.outline.geometry.coordinates,
        clip: e.outline.clip,
        label: e.outline.label,
      })),
    [shown],
  );
  // The globe turns toward the largest outline of the year.
  const turnTo = useMemo(() => {
    let best: { area: number; label: [number, number] } | null = null;
    for (const e of shown) {
      const area = geoArea(e.outline.geometry);
      if (!best || area > best.area) best = { area, label: e.outline.label };
    }
    return best?.label ?? null;
  }, [shown]);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="timeline">
      <div
        className="surface relative aspect-[16/10] min-h-0 overflow-hidden lg:aspect-auto lg:min-h-[14rem] lg:flex-1"
        data-testid="timeline-map"
      >
        <GlobeMap
          countries={countries}
          topology={world.topology}
          outlines={outlines}
          outlineLabel={labelFor}
          turnTo={turnTo}
          labelFor={labelFor}
          ariaLabel={t("atlas.timeline")}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t("atlas.year")}</span>
          <span className="text-xl font-medium tabular-nums" data-testid="timeline-year">
            {formatYear(year, t)}
          </span>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
          data-testid="timeline-slider"
        />
      </label>
      <p className="text-sm text-muted-foreground">{t("atlas.timelineHelp")}</p>
      {shown.length === 0 ? (
        <p data-testid="timeline-empty">{t("atlas.noOutlines")}</p>
      ) : (
        <ul
          className="surface shrink-0 divide-y divide-border lg:max-h-36 lg:overflow-y-auto"
          data-testid="timeline-list"
          // Scrolls on wide screens, so it takes focus for keyboard scrolling.
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1)
          tabIndex={0}
          aria-label={t("atlas.timeline")}
        >
          {shown.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5"
              data-testid="outline-caption"
              data-history={e.id}
            >
              <span className="font-medium">{e.names[locale]}</span>
              <span className="text-sm text-muted-foreground">
                {formatPeriod(e.period, t)}
                {", "}
                <span data-testid="outline-year">
                  {t("history.snapshot", { year: formatYear(e.outline.snapshotYear, t) })}
                </span>
                {e.outline.approximate ? (
                  <span data-testid="outline-approximate"> ({t("history.approximate")})</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
