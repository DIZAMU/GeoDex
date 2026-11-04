import { FlameIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { db } from "@/db/db";
import { setTourDone } from "@/db/settings";
import type { Streak } from "@/engine/streak";
import { parseCardId } from "@/engine/types";
import { isLocale } from "@/i18n/locales";
import { WorldMap } from "@/map/WorldMap";
import { Loader } from "@/ui/loader";
import { nameOf } from "../session/parts";
import { planDay, scopedCountries } from "../study/plan";
import { useProgress } from "../study/progress";
import { type Learner, useLearner } from "../study/useLearner";
import { Tour } from "../tour/Tour";
import { LevelLine } from "./LevelLine";
import { SessionPicker } from "./SessionPicker";

export function TodayScreen() {
  const learner = useLearner();
  if (!learner) return <Loader />;
  // A first-time visitor starts on the first screen (docs/PLAN-2.0.md).
  if (!learner.settings.homeCountry) return <Navigate to="/welcome" replace />;
  return <Today learner={learner} />;
}

/**
 * Today answers one question: what do I do now (docs/PLAN-2.0.md). The cards waiting and the
 * way to start come first; the map and the level follow.
 */
function Today({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const { streak } = useProgress(learner);
  const plan = useMemo(() => planDay({ ...learner, now: Date.now() }), [learner]);
  const region = plan.nextSubregion
    ? learner.world.subregions.find((s) => s.id === plan.nextSubregion)?.names[locale]
    : null;
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const minutes = Math.max(1, plan.budget.estimatedMinutes);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-6 md:px-10 md:py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <section aria-labelledby="today-title" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <p className="first-letter:uppercase">{date}</p>
          <StreakLine streak={streak} />
        </div>

        {plan.queue.length > 0 ? (
          <>
            <div className="flex flex-col gap-1" data-testid="summary">
              <h1 id="today-title" className="text-3xl font-medium tracking-tight">
                {t("today.due", {
                  count: plan.queue.length,
                  formatted: number.format(plan.queue.length),
                })}
              </h1>
              <p className="text-muted-foreground">
                {t("today.summary", {
                  reviews: t("today.reviews", { count: plan.dueCount }),
                  newCards: t("today.newCards", { count: plan.newCount }),
                  minutes,
                })}
              </p>
            </div>
            {plan.budget.paused ? (
              <p className="text-sm text-muted-foreground">{t("today.paused")}</p>
            ) : null}
            <SessionPicker learner={learner} queue={plan.queue} />
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <h1 id="today-title" className="text-3xl font-medium tracking-tight">
              {t("today.doneTitle")}
            </h1>
            <p className="max-w-[60ch] text-muted-foreground" data-testid="summary">
              {t("today.nothingLeft")}
            </p>
          </div>
        )}
      </section>

      <div className="flex min-w-0 flex-col gap-8" data-tour="progress">
        <TodayMap learner={learner} nextSubregion={plan.nextSubregion} region={region ?? null} />
        <LevelLine learner={learner} />
      </div>
      {/* The tour runs once, when Today has rendered its anchors. */}
      {learner.device.tourDoneAt == null ? (
        <Tour
          learner={learner}
          region={region ?? null}
          onDone={() => void setTourDone(db, Date.now())}
        />
      ) : null}
    </div>
  );
}

/** The streak in words, with freezes in reserve; the longest run sits in the tooltip. */
function StreakLine({ streak }: { streak: Streak }) {
  const { t } = useTranslation();
  return (
    <p
      className="inline-flex items-center gap-1.5"
      title={t("streak.longest", { count: streak.longest })}
      data-testid="streak"
    >
      <FlameIcon aria-hidden className="size-4" strokeWidth={1.75} />
      <span className="text-foreground">
        {streak.current > 0 ? t("streak.days", { count: streak.current }) : t("streak.none")}
      </span>
      {streak.freezes > 0 ? <span>{t("streak.freezes", { count: streak.freezes })}</span> : null}
    </p>
  );
}

/** The learner's map (PLAN.md 8.3): countries started, and the region learning moves to next. */
function TodayMap({
  learner,
  nextSubregion,
  region,
}: {
  learner: Learner;
  nextSubregion: string | null;
  region: string | null;
}) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const countries = useMemo(
    () => scopedCountries(learner.world, learner.settings),
    [learner.world, learner.settings],
  );
  const started = useMemo(() => {
    const ids = new Set<string>();
    for (const state of learner.states.values()) {
      if (state.phase !== "new") ids.add(parseCardId(state.cardId).entityId);
    }
    return ids;
  }, [learner.states]);
  const next = useMemo(
    () =>
      new Set(
        countries
          .filter((c) => c.subregion === nextSubregion && !started.has(c.id))
          .map((c) => c.id),
      ),
    [countries, nextSubregion, started],
  );
  const labelFor = useCallback(
    (id: string) => nameOf(learner.world, id, locale),
    [learner.world, locale],
  );
  const count = countries.filter((c) => started.has(c.id)).length;

  return (
    <section aria-labelledby="map-title" className="flex flex-col gap-3">
      <h2 id="map-title" className="sr-only">
        {t("today.mapTitle")}
      </h2>
      <div className="aspect-[2/1] overflow-hidden rounded-lg">
        <WorldMap
          countries={countries}
          topology={learner.world.topology}
          focus={{ kind: "world" }}
          highlight={{ filled: started, tinted: next }}
          labelFor={labelFor}
          ariaLabel={t("map.label")}
          interactive={false}
        />
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <li className="flex items-center gap-2" data-testid="map-started">
          <span aria-hidden className="size-3 rounded-sm bg-[var(--mastery-2)]" />
          {t("today.mapStarted", { count, total: countries.length })}
        </li>
        {next.size > 0 && region ? (
          <li className="flex items-center gap-2">
            <span aria-hidden className="size-3 rounded-sm border border-primary bg-primary/25" />
            {t("today.nextRegion", { name: region })}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
