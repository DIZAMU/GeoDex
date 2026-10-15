import { ArrowRightIcon, FlameIcon, MapPinIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router";
import { db } from "@/db/db";
import { setTourDone } from "@/db/settings";
import type { Streak } from "@/engine/streak";
import { parseCardId } from "@/engine/types";
import { isLocale } from "@/i18n/locales";
import { WorldMap } from "@/map/WorldMap";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { Stat } from "@/ui/stat";
import { nameOf } from "../session/parts";
import { planDay, scopedCountries } from "../study/plan";
import { useProgress } from "../study/progress";
import { type Learner, useLearner } from "../study/useLearner";
import { Tour } from "../tour/Tour";
import { InfoBox } from "./InfoBox";
import { SessionPicker } from "./SessionPicker";

export function TodayScreen() {
  const learner = useLearner();
  if (!learner) return <Loader />;
  // A first-time visitor starts on the welcome page (PLAN.md 11.1).
  if (!learner.settings.homeCountry) return <Navigate to="/welcome" replace />;
  return <Today learner={learner} />;
}

function Today({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const { streak } = useProgress(learner);
  const plan = useMemo(
    () => (learner.settings.homeCountry ? planDay({ ...learner, now: Date.now() }) : null),
    [learner],
  );

  const needsSetup =
    !learner.settings.homeCountry || learner.settings.placementCompletedAt === null;
  const region = plan?.nextSubregion
    ? learner.world.subregions.find((s) => s.id === plan.nextSubregion)?.names[locale]
    : null;
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:px-10 md:py-14 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:content-center lg:items-center lg:gap-14">
      <section aria-labelledby="today-title" className="stagger flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground first-letter:uppercase">{date}</p>
            {needsSetup ? null : <StreakChip streak={streak} />}
          </div>
          <h1 id="today-title" className="font-name text-4xl tracking-tight">
            {t("today.title")}
          </h1>
        </div>

        {needsSetup ? null : <InfoBox learner={learner} />}

        {needsSetup ? (
          <>
            <p className="max-w-[60ch] text-lg text-muted-foreground">{t("today.setupBody")}</p>
            <Button asChild size="lg" className="group self-start" data-testid="setup">
              <Link to={learner.settings.homeCountry ? "/placement" : "/onboarding"} viewTransition>
                {t("today.setup")}
                <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </>
        ) : plan && plan.queue.length > 0 ? (
          <>
            <dl
              className="grid grid-cols-3 gap-3"
              data-testid="summary"
              aria-label={t("today.summary", {
                reviews: t("today.reviews", { count: plan.dueCount }),
                newCards: t("today.newCards", { count: plan.newCount }),
                minutes: Math.max(1, plan.budget.estimatedMinutes),
              })}
            >
              <Stat label={t("today.statReviews")} value={number.format(plan.dueCount)} />
              <Stat label={t("today.statNew")} value={number.format(plan.newCount)} />
              <Stat
                label={t("today.statMinutes")}
                value={number.format(Math.max(1, plan.budget.estimatedMinutes))}
              />
            </dl>
            {plan.budget.paused ? (
              <p className="text-muted-foreground">{t("today.paused")}</p>
            ) : null}
            {region ? <RegionChip text={t("today.nextRegion", { name: region })} /> : null}
            <SessionPicker learner={learner} queue={plan.queue} />
          </>
        ) : plan ? (
          <>
            <p className="max-w-[60ch] text-lg" data-testid="summary">
              {t("today.nothingLeft")}
            </p>
            {region ? <RegionChip text={t("today.nextRegion", { name: region })} /> : null}
          </>
        ) : null}
      </section>

      <MapCard learner={learner} nextSubregion={plan?.nextSubregion ?? null} locale={locale} />
      {/* The tour runs once, after setup, when Today has rendered its anchors. */}
      {!needsSetup && learner.device.tourDoneAt == null ? (
        <Tour onDone={() => void setTourDone(db, Date.now())} />
      ) : null}
    </div>
  );
}

/** Current streak, with freezes in reserve; the longest run sits in the tooltip. */
function StreakChip({ streak }: { streak: Streak }) {
  const { t } = useTranslation();
  return (
    <p
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-sm tabular-nums"
      title={t("streak.longest", { count: streak.longest })}
      data-testid="streak"
    >
      <FlameIcon aria-hidden className="size-4 text-primary" />
      {streak.current > 0 ? t("streak.days", { count: streak.current }) : t("streak.none")}
      {streak.freezes > 0 ? (
        <span className="text-muted-foreground">
          {" · "}
          {t("streak.freezes", { count: streak.freezes })}
        </span>
      ) : null}
    </p>
  );
}

function RegionChip({ text }: { text: string }) {
  return (
    <p className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm">
      <MapPinIcon aria-hidden className="size-4 text-primary" />
      {text}
    </p>
  );
}

/** Mastery map thumbnail (PLAN.md 8.3): countries started, and the region learning moves to. */
function MapCard({
  learner,
  nextSubregion,
  locale,
}: {
  learner: Learner;
  nextSubregion: string | null;
  locale: "en" | "nb";
}) {
  const { t } = useTranslation();
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
    <section
      className="surface enter flex flex-col overflow-hidden"
      aria-labelledby="map-title"
      data-tour="map"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4 pb-3">
        <h2 id="map-title" className="font-name text-lg">
          {t("today.mapTitle")}
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("today.mapStarted", { count, total: countries.length })}
        </p>
      </div>
      <div className="aspect-[2/1] border-y border-border">
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
      <ul className="flex flex-wrap gap-x-5 gap-y-1 px-5 py-3 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-sm bg-primary/60" />
          {t("today.legendStarted")}
        </li>
        {next.size > 0 ? (
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3 rounded-sm border border-primary/60 bg-primary/20"
            />
            {t("today.legendNext")}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
