import { DumbbellIcon } from "lucide-react";
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
import { Meter } from "@/ui/meter";
import { nameOf } from "../session/parts";
import { useLevels } from "../study/levels";
import { confusionScoresFor, historyCardTypes, scopedCountries } from "../study/plan";
import { useProgress } from "../study/progress";
import { type Learner, useLearner } from "../study/useLearner";
import { LevelPath } from "../welcome/LevelPath";
import { achievementLabel } from "./labels";

/** A hook type needs this many outcomes before its rate is shown. */
const MIN_HOOK_OUTCOMES = 5;
const TOP_CONFUSIONS = 5;

export function StatsScreen() {
  const learner = useLearner();
  if (!learner) return <Loader />;
  return <Stats learner={learner} />;
}

/**
 * One section of the report: the title and a line of help on the left on a wide screen, the
 * content on the right. A hairline separates sections; nothing is boxed.
 */
function Section({
  title,
  help,
  id,
  children,
}: {
  title: string;
  help?: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid gap-3 border-t border-border py-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10"
      data-testid={`stats-${id}`}
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-lg font-medium">
          {title}
        </h2>
        {help ? <p className="text-sm text-muted-foreground">{help}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </section>
  );
}

function Stats({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const locale: Locale = isLocale(i18n.language) ? i18n.language : "en";
  const progress = useProgress(learner);
  const levels = useLevels(learner);
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
  const week = data.forecast.slice(0, 7).reduce((n, d) => n + d.count, 0);
  const continents = CONTINENTS.filter((c) => data.countries.some((x) => x.continent === c));
  const hookRows = HOOK_TYPES.map((type) => {
    const s = data.hooks.get(type) ?? { successes: 0, failures: 0 };
    return { type, n: s.successes + s.failures, weight: hookWeight(data.hooks, type) };
  })
    .filter((r) => r.n >= MIN_HOOK_OUTCOMES)
    .sort((a, b) => b.weight - a.weight);
  const levelRows = [
    ...continents.flatMap((c) => {
      const m = levels.byContinent.get(c);
      return m ? [{ key: c, name: t(`continent.${c}`), m }] : [];
    }),
    ...[...levels.byModule]
      .filter(([id, m]) => id !== "countries" && m.cards > 0)
      .map(([id, m]) => ({ key: id, name: t(`picker.module.${id}`), m })),
  ];
  const drillLink =
    "flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 md:px-10 lg:py-8">
      <h1 className="enter pb-6 text-3xl font-medium tracking-tight">{t("stats.title")}</h1>

      <Section title={t("stats.levelTitle")} help={t("stats.levelHelp")} id="level">
        <LevelBreakdown learner={learner} />
      </Section>

      <Section title={t("stats.forecast")} id="forecast">
        <p data-testid="forecast-week">
          {t("stats.forecastWeek", { count: week, formatted: number.format(week) })}
        </p>
        <div className="flex h-28 items-end gap-0.5" aria-hidden>
          {data.forecast.map((d, i) => (
            <span
              key={d.start}
              title={`${date.format(d.start)}: ${number.format(d.count)}`}
              className={`flex-1 rounded-t-sm ${i < 7 ? "bg-foreground" : "bg-muted-foreground/50"}`}
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
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{date.format(data.forecast[0]?.start ?? Date.now())}</span>
          <span>{date.format(data.forecast.at(-1)?.start ?? Date.now())}</span>
        </div>
      </Section>

      <Section title={t("stats.retention")} id="retention">
        {total === 0 ? (
          <p className="text-muted-foreground">{t("stats.noRetention")}</p>
        ) : (
          <>
            <p className="text-3xl font-medium tabular-nums">{percent.format(correct / total)}</p>
            <Meter
              value={correct / total}
              target={learner.settings.requestRetention}
              className="max-w-md"
            />
            <p className="text-sm text-muted-foreground">
              {t("stats.retentionValue", {
                correct: number.format(correct),
                total: number.format(total),
              })}
              {", "}
              {t("stats.target", { value: percent.format(learner.settings.requestRetention) })}
            </p>
          </>
        )}
      </Section>

      <Section title={t("stats.confusions")} help={t("stats.confusionsHelp")} id="confusions">
        {data.confusions.length === 0 ? (
          <p className="text-muted-foreground">{t("stats.noConfusions")}</p>
        ) : (
          <ul className="flex max-w-xl flex-col divide-y divide-border">
            {data.confusions.map(([key]) => {
              const [a = "", b = ""] = key.split("|");
              return (
                <li key={key} className="flex items-center justify-between gap-2 py-1">
                  <span>{t("stats.pair", { a: name(a), b: name(b) })}</span>
                  <Link
                    to={`/drill?a=${a}&b=${b}`}
                    viewTransition
                    className={drillLink}
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
      </Section>

      <Section title={t("stats.leeches")} help={t("stats.leechesHelp")} id="leeches">
        {data.leeches.length === 0 ? (
          <p className="text-muted-foreground">{t("stats.noLeeches")}</p>
        ) : (
          <ul className="flex max-w-xl flex-col divide-y divide-border">
            {data.leeches.slice(0, 8).map((s) => {
              const { entityId, type } = parseCardId(s.cardId);
              return (
                <li key={s.cardId} className="flex justify-between gap-2 py-2">
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
      </Section>

      <Section title={t("stats.recognition")} id="recognition">
        {data.recognition.of === 0 ? (
          <p className="text-muted-foreground">{t("stats.noRecognition")}</p>
        ) : (
          <>
            <p className="max-w-[62ch]">
              {t("stats.recognitionBody", {
                n: number.format(data.recognition.count),
                of: number.format(data.recognition.of),
              })}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {data.recognition.ids.slice(0, 12).map((id) => (
                <li key={id}>
                  <Link
                    to={`/atlas/${id}`}
                    viewTransition
                    className="underline decoration-border underline-offset-4 hover:decoration-foreground"
                  >
                    {name(id)}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title={t("stats.levels")} help={t("stats.levelsHelp")} id="levels">
        <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {levelRows.map(({ key, name, m }) => (
            <li key={key} className="flex flex-col gap-1.5" data-testid={`level-${key}`}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {t("overview.levelShort", { level: m.level })}
                </span>
              </div>
              <Meter value={m.share} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("stats.grid")} help={t("stats.gridHelp")} id="grid">
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
                    const cell = row?.get(c) ?? { total: 0, started: 0, mastered: 0 };
                    const share = cell.total ? cell.mastered / cell.total : 0;
                    // Color follows the number in the cell: the mastered share, nothing else.
                    const level = cell.mastered === 0 ? 0 : Math.min(4, 1 + Math.floor(share * 4));
                    return (
                      <td
                        key={c}
                        className="rounded-md px-2 py-2 tabular-nums"
                        style={{
                          background: `var(--mastery-${level})`,
                          color: `var(--on-mastery-${level})`,
                        }}
                        title={t("stats.cell", {
                          mastered: number.format(cell.mastered),
                          started: number.format(cell.started),
                          total: number.format(cell.total),
                        })}
                      >
                        {percent.format(share)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </Section>

      <Section title={t("stats.hooks")} help={t("stats.hooksHelp")} id="hooks">
        {hookRows.length === 0 ? (
          <p className="text-muted-foreground">{t("stats.noHooks")}</p>
        ) : (
          <ul className="flex max-w-xl flex-col gap-3">
            {hookRows.map((r) => (
              <li key={r.type} className="flex flex-col gap-1.5">
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
      </Section>

      <Section title={t("stats.activity")} id="activity">
        <Heatmap days={data.activity} locale={locale} />
        <p className="text-sm text-muted-foreground">
          {t("streak.longest", { count: progress.streak.longest })}
        </p>
      </Section>

      <Section title={t("stats.achievements")} id="achievements">
        {progress.achievements.length === 0 ? (
          <p className="text-muted-foreground">{t("stats.noAchievements")}</p>
        ) : (
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {[...progress.achievements].reverse().map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between gap-3 border-b border-border py-2"
              >
                <span className="min-w-0">{achievementLabel(a, learner.world, locale, t)}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {date.format(a.earnedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/**
 * The full level and XP picture, moved here from Today: the memory level with the way to the
 * next one and the path to 10, then rank and XP with the way to the next XP level, then the
 * daily goal.
 */
function LevelBreakdown({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const { overall, xp, goal } = useLevels(learner);
  const showPercent = learner.device.levelProgress === "percent";
  const within = overall.within;
  const goalDone = Math.min(Math.floor(goal.done), goal.target);
  // XP shows as the way to the next rank; "level" on this screen is only the memory level.
  const toRank =
    xp.nextRank === null
      ? t("overview.topRank")
      : t("overview.xpToRank", {
          xp: number.format(xp.toNextRank ?? 0),
          rank: t(`rank.${xp.nextRank}`),
        });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-3xl font-medium tabular-nums">
            {t("overview.levelShort", { level: number.format(overall.level) })}
          </span>
          <span className="text-sm text-muted-foreground">
            {overall.cardsToNext === null
              ? t("overview.top")
              : showPercent
                ? t("overview.toNextPercent", {
                    percent: percent.format(within),
                    level: overall.level + 1,
                  })
                : t("overview.toNext", { count: overall.cardsToNext, level: overall.level + 1 })}
          </span>
        </p>
        <Meter value={within} tall label={t("overview.levelLabel", { level: overall.level })} />
      </div>
      <LevelPath current={overall.level} />
      <div className="flex flex-col gap-2" data-testid="stats-xp">
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span>
            <span className="font-medium">{t(`rank.${xp.rank}`)}</span>
            <span className="text-muted-foreground">
              {", "}
              {t("overview.xp", { xp: number.format(xp.xp) })}
            </span>
          </span>
          <span className="text-sm text-muted-foreground" data-testid="next-rank">
            {toRank}
          </span>
        </p>
        <Meter value={xp.rankShare} label={toRank} />
      </div>
      <p className="text-sm text-muted-foreground">
        {goal.kind === "minutes"
          ? t("overview.goalMinutesLabel", { done: goalDone, count: goal.target })
          : t("overview.goalSessionsLabel", { done: goalDone, count: goal.target })}
      </p>
    </div>
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
