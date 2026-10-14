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

  return (
    <div className="stagger mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 md:py-14">
      <h1 className="font-name text-4xl tracking-tight">{t("onboarding.title")}</h1>
      <div className="surface p-5 md:p-7">
        <LanguageSwitcher />
      </div>
      <section className="surface flex flex-col gap-3 p-5 md:p-7">
        <h2 className="font-name text-xl">{t("onboarding.home")}</h2>
        <p className="text-muted-foreground">{t("onboarding.homeHelp")}</p>
        <CountryPicker countries={countries} value={home} onChange={setHome} locale={locale} />
      </section>
      <section className="surface flex flex-col gap-4 p-5 md:p-7" data-testid="placement-offer">
        <h2 className="font-name text-xl">{t("onboarding.placementTitle")}</h2>
        <p className="text-muted-foreground">{t("onboarding.placementBody")}</p>
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            disabled={!home}
            data-testid="start-placement"
            onClick={async () => {
              if (!home) return;
              await updateSettings(db, { homeCountry: home });
              await db.placementProgress.clear();
              navigate("/placement", { viewTransition: true });
            }}
          >
            {t("onboarding.takeTest")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!home}
            data-testid="start-from-zero"
            onClick={async () => {
              if (!home) return;
              // Skipping the test counts as finishing it with nothing known yet.
              await updateSettings(db, { homeCountry: home, placementCompletedAt: Date.now() });
              await db.placementProgress.clear();
              navigate("/", { viewTransition: true });
            }}
          >
            {t("onboarding.fromZero")}
          </Button>
        </div>
      </section>
    </div>
  );
}
