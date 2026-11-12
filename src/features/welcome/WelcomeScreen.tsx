/**
 * The first screen: a live question on the map, one line on what GeoDex
 * is, and the way in. Below it, the topics as a plain list and what a few minutes a day gets
 * you, from the data. New visitors land here; returning learners reach it through Help.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { SiteFooter } from "@/app/SiteFooter";
import { masteryEstimate } from "@/engine/estimate";
import { isLocale, LOCALES } from "@/i18n/locales";
import { useLocale } from "@/i18n/useLocale";
import { BackToTop } from "@/ui/back-to-top";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import lockup from "../../../assets/brand/svg/geodex-lockup.svg";
import lockupOnDark from "../../../assets/brand/svg/geodex-lockup-on-dark.svg";
import { type Learner, useLearner } from "../study/useLearner";
import { Demo } from "./Demo";
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
  const number = new Intl.NumberFormat(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-10">
          <Link to="/welcome" className="flex h-11 items-center rounded-lg">
            <img src={lockup} alt={t("app.name")} className="brand-on-light h-7 w-auto" />
            <img src={lockupOnDark} alt={t("app.name")} className="brand-on-dark h-7 w-auto" />
          </Link>
          <CompactLanguage />
        </div>
      </header>

      <main className="flex-1">
        {/*
         * On a phone the question comes right after the title, and the way in follows it.
         * On a desktop the text and the way in sit to the left of the question.
         */}
        <section
          aria-labelledby="welcome-title"
          className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-8 pb-14 md:px-10 md:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-12 lg:gap-y-6"
        >
          <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:self-end">
            <h1
              id="welcome-title"
              className="max-w-[18ch] text-2xl font-medium tracking-tight md:text-3xl"
            >
              {t("welcome.title")}
            </h1>
            <p className="max-w-[44ch] text-lg text-muted-foreground">{t("welcome.lead")}</p>
          </div>
          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <Demo learner={learner} locale={locale} />
          </div>
          <div className="flex flex-col items-start gap-3 lg:col-start-1 lg:row-start-2 lg:self-start">
            <Button size="lg" onClick={start} data-testid="setup">
              {t("welcome.start")}
            </Button>
            <p className="text-sm text-muted-foreground" data-testid="welcome-free">
              {t("welcome.facts")}
            </p>
          </div>
        </section>

        <section
          aria-labelledby="topics-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-12 md:px-10"
        >
          <h2 id="topics-title" className="text-xl font-medium">
            {t("welcome.topicsTitle")}
          </h2>
          <dl className="grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3" data-testid="welcome-topics">
            {list.map(({ id, count, optional }) => (
              <div key={id} className="flex flex-col border-b border-border py-3">
                <dt className="font-medium">{t(`welcome.topics.${id}.name`)}</dt>
                <dd className="text-sm text-muted-foreground">
                  {t(`welcome.topics.${id}.detail`, { count, formatted: number.format(count) })}
                  {optional ? `. ${t("welcome.optional")}` : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="pace-title"
          className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-12 md:px-10"
        >
          <h2 id="pace-title" className="text-xl font-medium">
            {t("welcome.paceTitle", { minutes: estimate.minutes })}
          </h2>
          <p className="max-w-[62ch] text-muted-foreground" data-testid="welcome-estimate">
            {t("welcome.timeBody", {
              minutes: estimate.minutes,
              weeks: estimate.weeks,
              months: estimate.months,
            })}{" "}
            {t("welcome.timeAll", { months: estimate.allMonths })}
          </p>
          <p className="max-w-[62ch] text-muted-foreground">{t("welcome.memory")}</p>
        </section>

        <section className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 border-t border-border px-4 py-12 md:px-10">
          <p className="max-w-[52ch] text-lg">{t("welcome.close")}</p>
          <Button variant="secondary" size="lg" onClick={start} data-testid="setup-end">
            {t("welcome.start")}
          </Button>
        </section>
      </main>
      <SiteFooter />
      <BackToTop />
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
          {option === "en" ? "English" : "Norsk"}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
