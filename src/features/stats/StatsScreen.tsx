import { AwardIcon, DumbbellIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CONTINENTS } from "@/data/types";
import { isMastered, SKILL_IDS } from "@/engine/achievements";
import { hookStats, hookWeight } from "@/engine/explain/select";
import { HOOK_TYPES } from "@/engine/explain/types";
import { activity, forecast, leeches, recognitionOnly, retention, skillGrid } from "@/engine/stats";
import {
  type CardType,
  CITY_CARD_TYPES,
  cardId,
  LANDMARK_CARD_TYPES,
  PHYSICAL_CARD_TYPES,
  parseCardId,
} from "@/engine/types";
import { isLocale, type Locale } from "@/i18n/locales";
import { Loader } from "@/ui/loader";
import { nameOf } from "../session/parts";
import { confusionScoresFor, historyCardTypes, scopedCountries } from "../study/plan";
import { useProgress } from "../study/progress";
import { type Learner, useLearner } from "../study/useLearner";
import { achievementLabel } from "./labels";

/** A hook type needs this many outcomes before its rate is shown. */
const MIN_HOOK_OUTCOMES = 5;
const TOP_CONFUSIONS = 5;

export function StatsScreen() {
  const learner = useLearner();
  if (!learner) return <Loader />;
  return <Stats learner={learner} />;
}

function Panel({
  title,
  id,
  className,
  children,
}: {
  title: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`surface flex min-w-0 flex-col gap-3 p-5 ${className ?? ""}`}
      data-testid={`stats-${id}`}
    >
      <h2 id={`${id}-title`} className="font-name text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stats({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const locale: Locale = isLocale(i18n.language) ? i18n.language : "en";
  const progress = useProgress(learner);
  const dsh = learner.settings.dayStartHour;
  const data = useMemo(() => {
    const now = Date.now();
    const countries = scopedCountries(learner.world, learner.settings);
    const states = [...learner.states.values()];
    const scores = confusionScoresFor(learner.world, learner.events, now);
    return {
      countries,
      grid: skillGrid(countries, learner.states),
      cityGrid: moduleGrid(learner, countries, learner.world.cities, CITY_CARD_TYPES),
      landmarkGrid: moduleGrid(learner, countries, learner.world.landmarks, LANDMARK_CARD_TYPES),
      // A physical feature counts on the continent of the first country it touches.
      physicalGrid: moduleGrid(
        learner,
        countries,
        learner.world.physical.flatMap((f) =>
          f.countries[0] ? [{ id: f.id, countryId: f.countries[0] }] : [],
        ),
        PHYSICAL_CARD_TYPES,
      ),
      // A history entity counts on the continent it is grouped under, via its first country.
      historyGrid: moduleGrid(
        learner,
        countries,
        learner.world.history.flatMap((e) =>
          e.countries[0] ? [{ id: e.id, countryId: e.countries[0] }] : [],
        ),
        (id) => {
          const e = learner.world.historyById.get(id);
          return e ? historyCardTypes(e, (c) => learner.world.byId.has(c)) : [];
        },
      ),
      retention: retention(learner.events, now, dsh),
      forecast: forecast(states, now, dsh),
      activity: activity(learner.events, now, dsh),
      leeches: leeches(states),
      recognition: recognitionOnly(learner.states),
      confusions: [...scores]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, TOP_CONFUSIONS),
      hooks: hookStats(learner.events, learner.votes, learner.content.hookType),
    };
  }, [learner, dsh]);
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const name = (id: string) => nameOf(learner.world, id, locale);

  const total = data.retention.reduce((n, r) => n + r.total, 0);
  const correct = data.retention.reduce((n, r) => n + r.correct, 0);
  const forecastMax = Math.max(1, ...data.forecast.map((d) => d.count));
  const continents = CONTINENTS.filter((c) => data.countries.some((x) => x.continent === c));
  const hookRows = HOOK_TYPES.map((type) => {
    const s = data.hooks.get(type) ?? { successes: 0, failures: 0 };
    return { type, n: s.successes + s.failures, weight: hookWeight(data.hooks, type) };
  })
    .filter((r) => r.n >= MIN_HOOK_OUTCOMES)
    .sort((a, b) => b.weight - a.weight);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-10 lg:py-8">
      <h1 className="font-name text-3xl tracking-tight">{t("stats.title")}</h1>

      <div className="stagger grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Panel title={t("stats.grid")} id="grid" className="lg:col-span-2">
          <p className="text-sm text-muted-foreground">{t("stats.gridHelp")}</p>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1) */}
          <section className="overflow-x-auto" tabIndex={0} aria-label={t("stats.grid")}>
            <table className="w-full min-w-[32rem] border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th className="sr-only">{t("atlas.show")}</th>
                  {continents.map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className="px-1 text-left font-normal text-muted-foreground"
                    >
                      {t(`continent.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ...SKILL_IDS.map((skill) => ({
                    key: skill as string,
                    label: t(`skill.${skill}`),
                    row: data.grid.get(skill),
                  })),
                  ...(learner.settings.modules.cities
                    ? [{ key: "cities", label: t("stats.cities"), row: data.cityGrid }]
                    : []),
                  ...(learner.settings.modules.landmarks
                    ? [{ key: "landmarks", label: t("stats.landmarks"), row: data.landmarkGrid }]
                    : []),
                  ...(learner.settings.modules.physical
                    ? [{ key: "physical", label: t("stats.physical"), row: data.physicalGrid }]
                    : []),
                  ...(learner.settings.modules.history
                    ? [{ key: "history", label: t("stats.history"), row: data.historyGrid }]
                    : []),
                ].map(({ key, label, row }) => (
                  <tr key={key}>
                    <th scope="row" className="pr-2 text-left font-normal whitespace-nowrap">
                      {label}
                    </th>
                    {continents.map((c) => {
                      const cell = row?.get(c) ?? {
                        total: 0,
                        started: 0,
                        mastered: 0,
                      };
                      const share = cell.total ? cell.mastered / cell.total : 0;
                      // Color follows the number in the cell: the mastered share, nothing else.
                      const level =
                        cell.mastered === 0 ? 0 : Math.min(4, 1 + Math.floor(share * 4));
                      return (
                        <td
                          key={c}
                          className="rounded-md px-2 py-2 tabular-nums"
                          style={{ background: `var(--mastery-${level})` }}
                          title={t("stats.cell", {
                            mastered: number.format(cell.mastered),
                            started: number.format(cell.started),
                            total: number.format(cell.total),
                          })}
                        >
                          <span className="rounded bg-card/85 px-1.5 py-0.5 text-foreground">
                            {percent.format(share)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </Panel>

        <Panel title={t("stats.retention")} id="retention">
          {total === 0 ? (
            <p className="text-muted-foreground">{t("stats.noRetention")}</p>
          ) : (
            <>
              <p className="font-name text-4xl tabular-nums">{percent.format(correct / total)}</p>
              <p className="text-sm text-muted-foreground">
                {t("stats.retentionValue", {
                  correct: number.format(correct),
                  total: number.format(total),
                })}
                {", "}
                {t("stats.target", { value: percent.format(learner.settings.requestRetention) })}
              </p>
              <Meter value={correct / total} target={learner.settings.requestRetention} />
            </>
          )}
        </Panel>

        <Panel title={t("stats.forecast")} id="forecast" className="lg:col-span-2">
          <div className="flex h-32 items-end gap-0.5" aria-hidden>
            {data.forecast.map((d) => (
              <span
                key={d.start}
                title={`${date.format(d.start)}: ${number.format(d.count)}`}
                className="flex-1 rounded-t-sm bg-primary/70"
                style={{ height: `${Math.max(2, (d.count / forecastMax) * 100)}%` }}
              />
            ))}
          </div>
          <ol className="sr-only">
            {data.forecast.map((d) => (
              <li key={d.start}>
                {date.format(d.start)}: {number.format(d.count)}
              </li>
            ))}
          </ol>
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{date.format(data.forecast[0]?.start ?? Date.now())}</span>
            <span>{date.format(data.forecast.at(-1)?.start ?? Date.now())}</span>
          </div>
        </Panel>

        <Panel title={t("stats.recognition")} id="recognition">
          {data.recognition.of === 0 ? (
            <p className="text-muted-foreground">{t("stats.noRecognition")}</p>
          ) : (
            <>
              <p>
                {t("stats.recognitionBody", {
                  n: number.format(data.recognition.count),
                  of: number.format(data.recognition.of),
                })}
              </p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {data.recognition.ids.slice(0, 12).map((id) => (
                  <li key={id}>
                    <Link
                      to={`/atlas/${id}`}
                      viewTransition
                      className="underline decoration-border underline-offset-4 hover:decoration-primary"
                    >
                      {name(id)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel title={t("stats.confusions")} id="confusions">
          {data.confusions.length === 0 ? (
            <p className="text-muted-foreground">{t("stats.noConfusions")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.confusions.map(([key, score]) => {
                const [a = "", b = ""] = key.split("|");
                return (
                  <li key={key} className="flex items-center justify-between gap-2 py-1.5">
                    <span>
                      {name(a)} / {name(b)}
                      <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                        {number.format(score)}
                      </span>
                    </span>
                    <Link
                      to={`/drill?a=${a}&b=${b}`}
                      viewTransition
                      className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={t("drill.pair", { a: name(a), b: name(b) })}
                      title={t("stats.drill")}
                    >
                      <DumbbellIcon className="size-4" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t("stats.leeches")} id="leeches">
          {data.leeches.length === 0 ? (
            <p className="text-muted-foreground">{t("stats.noLeeches")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {data.leeches.slice(0, 8).map((s) => {
                const { entityId, type } = parseCardId(s.cardId);
                return (
                  <li key={s.cardId} className="flex justify-between gap-2 py-1.5">
                    <span>
                      {entityId.includes("|")
                        ? entityId.split("|").map(name).join(" / ")
                        : name(entityId)}
                    </span>
                    <span className="text-sm text-muted-foreground">{t(`cardType.${type}`)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={t("stats.hooks")} id="hooks">
          {hookRows.length === 0 ? (
            <p className="text-muted-foreground">{t("stats.noHooks")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {hookRows.map((r) => (
                <li key={r.type} className="flex flex-col gap-1">
                  <span className="flex justify-between gap-2 text-sm">
                    {t(`hookType.${r.type}`)}
                    <span className="text-muted-foreground tabular-nums">
                      {t("stats.hookRate", { value: percent.format(r.weight) })}
                    </span>
                  </span>
                  <Meter value={r.weight} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("stats.activity")} id="activity" className="lg:col-span-3">
          <Heatmap days={data.activity} locale={locale} />
          <p className="text-sm text-muted-foreground">
            {t("streak.longest", { count: progress.streak.longest })}
          </p>
        </Panel>

        <Panel title={t("stats.achievements")} id="achievements" className="lg:col-span-3">
          {progress.achievements.length === 0 ? (
            <p className="text-muted-foreground">{t("stats.noAchievements")}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...progress.achievements].reverse().map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <AwardIcon aria-hidden className="size-5 shrink-0 text-primary" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      {achievementLabel(a, learner.world, locale, t)}
                    </span>
                    <span className="text-xs text-muted-foreground">{date.format(a.earnedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Meter({ value, target }: { value: number; target?: number }) {
  return (
    <span aria-hidden className="relative block h-2 w-full overflow-hidden rounded-full bg-muted">
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-primary"
        style={{ width: `${value * 100}%` }}
      />
      {target !== undefined ? (
        <span
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `${target * 100}%` }}
        />
      ) : null}
    </span>
  );
}

/** Weeks as columns, days as rows. Intensity uses the luminance ramp; each cell has a title. */
function Heatmap({ days, locale }: { days: { start: number; count: number }[]; locale: Locale }) {
  const { t } = useTranslation();
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const number = new Intl.NumberFormat(locale);
  const max = Math.max(1, ...days.map((d) => d.count));
  const offset = (new Date(days[0]?.start ?? 0).getDay() + 6) % 7;
  const reviewed = days.filter((d) => d.count > 0).length;
  // Narrow screens show the latest weeks first; older ones are a scroll away.
  const scroller = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);
  return (
    <section
      ref={scroller}
      className="overflow-x-auto"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1)
      tabIndex={0}
      aria-label={t("stats.activity")}
    >
      <div
        role="img"
        aria-label={`${t("stats.activity")}: ${number.format(reviewed)}`}
        className="grid w-max grid-flow-col grid-rows-7 gap-[3px]"
      >
        {Array.from({ length: offset }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: leading blanks have no identity
          <span key={`pad-${i}`} className="size-3" />
        ))}
        {days.map((d) => {
          const level = d.count === 0 ? 0 : Math.min(4, 1 + Math.floor((d.count / max) * 3.999));
          return (
            <span
              key={d.start}
              title={`${date.format(d.start)}: ${number.format(d.count)}`}
              className="size-3 rounded-[3px] border border-border/50"
              style={{ background: `var(--mastery-${level})` }}
            />
          );
        })}
      </div>
    </section>
  );
}

/** A module's items per continent, like a skill row: every card counts, mastered at 21+ days. */
function moduleGrid(
  learner: Learner,
  countries: readonly { id: string; continent: string }[],
  items: readonly { id: string; countryId: string }[],
  types: readonly CardType[] | ((id: string) => readonly CardType[]),
): Map<string, { total: number; started: number; mastered: number }> {
  const continentOf = new Map(countries.map((c) => [c.id, c.continent]));
  const grid = new Map<string, { total: number; started: number; mastered: number }>();
  for (const item of items) {
    const continent = continentOf.get(item.countryId);
    if (!continent) continue;
    const cell = grid.get(continent) ?? { total: 0, started: 0, mastered: 0 };
    for (const type of typeof types === "function" ? types(item.id) : types) {
      const state = learner.states.get(cardId(item.id, type));
      cell.total++;
      if (state && state.phase !== "new") cell.started++;
      if (isMastered(state)) cell.mastered++;
    }
    grid.set(continent, cell);
  }
  return grid;
}
