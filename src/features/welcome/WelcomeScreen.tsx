/**
 * The welcome page (PLAN.md 11.1): what GeoDex is, that it is free, what you can learn and
 * get, how it works, the level path and three sample questions. New visitors land here;
 * returning learners go straight to Today and can come back through Help.
 */
import {
  ArrowRightIcon,
  BrainIcon,
  CheckIcon,
  ClockIcon,
  HeartIcon,
  PlayIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { masteryEstimate } from "@/engine/estimate";
import { createRng, shuffle } from "@/engine/random";
import { isLocale, LOCALES } from "@/i18n/locales";
import { useLocale } from "@/i18n/useLocale";
import { GlobeMap } from "@/map/GlobeMap";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import lockup from "../../../assets/brand/svg/geodex-lockup.svg";
import lockupOnDark from "../../../assets/brand/svg/geodex-lockup-on-dark.svg";
import { nameOf } from "../session/parts";
import { scopedCountries } from "../study/plan";
import { type Learner, useLearner } from "../study/useLearner";
import { Demo } from "./Demo";
import { LevelPath } from "./LevelPath";
import { cardCounts, topics } from "./topics";

export function WelcomeScreen() {
  const learner = useLearner();
  if (!learner) return <Loader />;
  return <Welcome learner={learner} />;
}

function Welcome({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const navigate = useNavigate();
  const returning = learner.settings.homeCountry !== null;
  const start = () => navigate(returning ? "/" : "/onboarding", { viewTransition: true });
  const list = useMemo(() => topics(learner.world), [learner.world]);
  const count = (id: string) => list.find((x) => x.id === id)?.count ?? 0;
  const estimate = useMemo(() => {
    const cards = cardCounts(learner.world);
    const minutes = learner.settings.dailyMinutes;
    const core = masteryEstimate({ totalCards: cards.core, dailyMinutes: minutes });
    const all = masteryEstimate({ totalCards: cards.all, dailyMinutes: minutes });
    return {
      minutes,
      weeks: Math.max(1, Math.ceil(core.daysToIntroduce / 7)),
      months: core.months,
      allMonths: all.months,
    };
  }, [learner.world, learner.settings.dailyMinutes]);
  const countries = useMemo(
    () => scopedCountries(learner.world, learner.settings),
    [learner.world, learner.settings],
  );
  const labelFor = useCallback(
    (id: string) => nameOf(learner.world, id, locale),
    [learner.world, locale],
  );
  const number = new Intl.NumberFormat(locale);
  const lit = useLighting(countries.map((c) => c.id));

  return (
    <div className="welcome min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 md:px-10">
          <Link to="/welcome" className="flex h-11 items-center rounded-lg">
            <img src={lockup} alt={t("app.name")} className="brand-on-light h-7 w-auto" />
            <img src={lockupOnDark} alt={t("app.name")} className="brand-on-dark h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <CompactLanguage />
            <Button size="sm" className="hidden sm:inline-flex" onClick={start}>
              {t("welcome.start")}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: what it is, that it is free, what you can learn, and how to start. */}
        <section
          aria-labelledby="welcome-title"
          className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pt-8 pb-10 md:px-10 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-12 lg:py-10"
        >
          <div className="stagger flex flex-col gap-5">
            <p className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-card/60 px-3 py-1 text-sm">
              <HeartIcon aria-hidden className="size-4 text-primary" />
              {t("welcome.eyebrow")}
            </p>
            <h1
              id="welcome-title"
              className="font-name text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            >
              {t("welcome.title")}
            </h1>
            <p className="max-w-[56ch] text-lg text-muted-foreground">{t("welcome.lead")}</p>
            <div
              className="flex flex-col gap-1 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3"
              data-testid="welcome-free"
            >
              <p className="flex items-center gap-2 font-semibold">
                <ShieldCheckIcon aria-hidden className="size-5 shrink-0 text-primary" />
                {t("welcome.free")}
              </p>
              <p className="text-sm text-muted-foreground">{t("welcome.freeWhy")}</p>
            </div>
            <ul
              className="flex flex-wrap gap-2"
              aria-label={t("welcome.topicsTitle")}
              data-testid="welcome-topic-pills"
            >
              {list.map(({ id, icon: Icon }) => (
                <li
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-sm"
                >
                  <Icon aria-hidden className="size-3.5 text-primary" />
                  {t(`welcome.topics.${id}.name`)}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                size="lg"
                className="group h-12 px-6 text-base"
                onClick={start}
                data-testid="setup"
              >
                {t("welcome.start")}
                <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <a href="#demo" data-testid="welcome-try">
                  <PlayIcon aria-hidden />
                  {t("welcome.try")}
                </a>
              </Button>
            </div>
          </div>
          <div className="enter relative mx-auto aspect-square w-full max-w-[30rem]" aria-hidden>
            <div className="welcome-glow absolute inset-[8%] rounded-full" />
            <GlobeMap
              countries={countries}
              topology={learner.world.topology}
              labelFor={labelFor}
              ariaLabel={t("map.label")}
              initialCenter={[15, 30]}
              autoRotate={6}
              levels={lit}
              decorative
            />
          </div>
        </section>

        <Section id="topics" title={t("welcome.topicsTitle")}>
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="welcome-topics"
          >
            {list.map(({ id, icon: Icon, count: n, optional }) => (
              <li key={id} className="surface flex items-start gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-name text-lg">
                    {t(`welcome.topics.${id}.name`)}
                    {optional ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {t("welcome.optional")}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">
                    {t(`welcome.topics.${id}.detail`, { count: n, formatted: number.format(n) })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="get" title={t("welcome.getTitle")}>
          <div className="grid gap-4 lg:grid-cols-3">
            <ul className="surface flex flex-col gap-3 p-6 lg:row-span-2" data-testid="welcome-get">
              {[
                t("welcome.get.countries", { count: count("countries") }),
                t("welcome.get.capitals"),
                t("welcome.get.currency"),
                t("welcome.get.extras", {
                  cities: count("cities"),
                  landmarks: count("landmarks"),
                  physical: count("physical"),
                  history: count("history"),
                }),
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <CheckIcon aria-hidden className="size-4" />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <InfoCard
              icon={<BrainIcon aria-hidden className="size-5" />}
              title={t("welcome.memoryTitle")}
            >
              {t("welcome.memoryBody")}
            </InfoCard>
            <InfoCard
              icon={<ClockIcon aria-hidden className="size-5" />}
              title={t("welcome.timeTitle")}
            >
              <span data-testid="welcome-estimate">
                {t("welcome.timeBody", {
                  minutes: estimate.minutes,
                  weeks: estimate.weeks,
                  months: estimate.months,
                })}{" "}
                {t("welcome.timeAll", { months: estimate.allMonths })}
              </span>
            </InfoCard>
          </div>
        </Section>

        <Section id="how" title={t("welcome.howTitle")}>
          <ol className="grid gap-4 md:grid-cols-3" data-testid="welcome-how">
            {(["home", "daily", "fill"] as const).map((step, i) => (
              <li key={step} className="surface flex flex-col gap-3 p-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary font-name text-lg text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="font-name text-xl">{t(`welcome.steps.${step}.title`)}</h3>
                <p className="text-muted-foreground">{t(`welcome.steps.${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="levels" title={t("welcome.levelsTitle")}>
          <div className="surface flex flex-col gap-5 p-6 md:p-8">
            <p className="max-w-[65ch] text-muted-foreground">{t("welcome.levelsBody")}</p>
            <LevelPath />
          </div>
        </Section>

        <Section id="demo" title={t("welcome.demoTitle")} lead={t("welcome.demoBody")}>
          <Demo learner={learner} locale={locale} />
        </Section>

        <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 md:px-10">
          <div className="surface flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex flex-col gap-1">
              <p className="font-name text-2xl">{t("welcome.free")}</p>
              <p className="text-muted-foreground">{t("welcome.privacy")}</p>
            </div>
            <Button size="lg" className="group h-12 px-6 text-base" onClick={start}>
              {t("welcome.start")}
              <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Button>
          </div>
          <p className="pt-6 text-center text-sm text-muted-foreground">{t("welcome.madeBy")}</p>
        </section>
      </main>
    </div>
  );
}

/**
 * Countries light up one after another through the mastery ramp, as a learner's map would,
 * then start over. With reduced motion the globe shows one fixed, half-lit state.
 */
function useLighting(ids: readonly string[]): ReadonlyMap<string, number> {
  const [tick, setTick] = useState(0);
  const order = useMemo(() => {
    const rng = createRng("welcome-globe");
    return shuffle([...ids], rng);
  }, [ids]);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setTick(40);
      return;
    }
    const id = window.setInterval(() => setTick((n) => (n + 1) % 90), 450);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => {
    const lit = new Map<string, number>();
    const shown = Math.min(order.length, tick * 3);
    for (let i = 0; i < shown; i++) {
      const id = order[i];
      // Earlier countries have had longer to grow.
      if (id) lit.set(id, Math.min(4, 1 + Math.floor((shown - i) / 25)));
    }
    return lit;
  }, [order, tick]);
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-5 px-4 py-10 md:px-10 md:py-14"
    >
      <div className="flex flex-col gap-2">
        <h2 id={`${id}-title`} className="font-name text-3xl tracking-tight">
          {title}
        </h2>
        {lead ? <p className="text-muted-foreground">{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="surface flex flex-col gap-3 p-6 lg:col-span-2">
      <h3 className="flex items-center gap-3 font-name text-xl">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </span>
        {title}
      </h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function CompactLanguage() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={locale}
      aria-label={t("welcome.language")}
      onValueChange={(value) => {
        if (isLocale(value)) setLocale(value);
      }}
    >
      {LOCALES.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          lang={option}
          data-testid={`welcome-locale-${option}`}
        >
          {option.toUpperCase()}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
