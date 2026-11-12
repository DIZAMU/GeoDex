import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { db } from "@/db/db";
import { updateSettings } from "@/db/settings";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { isLocale } from "@/i18n/locales";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { scopedCountries } from "../study/plan";
import { useLearner } from "../study/useLearner";
import { CountryPicker, guessHomeCountry } from "./CountryPicker";

/** Two choices before the first session: language and home country. */
export function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const learner = useLearner();
  const navigate = useNavigate();
  const [home, setHome] = useState<string | null>(null);

  useEffect(() => {
    if (learner && home === null) {
      setHome(
        learner.settings.homeCountry ??
          guessHomeCountry(navigator.languages, learner.world.countries),
      );
    }
  }, [learner, home]);

  if (!learner) return <Loader />;
  const countries = scopedCountries(learner.world, learner.settings);
  const chosen = home ? learner.world.byId.get(home)?.names[locale] : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-8 md:py-14">
      <h1 className="text-2xl font-medium tracking-tight">{t("onboarding.title")}</h1>
      <LanguageSwitcher />
      <section className="flex flex-col gap-3" aria-labelledby="home-title">
        <h2 id="home-title" className="text-lg font-medium">
          {t("onboarding.home")}
        </h2>
        <p className="text-muted-foreground">{t("onboarding.homeHelp")}</p>
        <CountryPicker countries={countries} value={home} onChange={setHome} locale={locale} />
      </section>
      <div className="flex flex-col items-start gap-2">
        <Button
          size="lg"
          disabled={!home}
          data-testid="start-learning"
          onClick={async () => {
            if (!home) return;
            // placementCompletedAt marks setup as done; there is no placement test in 2.0.
            await updateSettings(db, { homeCountry: home, placementCompletedAt: Date.now() });
            navigate("/", { viewTransition: true });
          }}
        >
          {t("onboarding.start")}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {chosen ? t("onboarding.chosen", { name: chosen }) : t("onboarding.choose")}
        </p>
      </div>
    </div>
  );
}
