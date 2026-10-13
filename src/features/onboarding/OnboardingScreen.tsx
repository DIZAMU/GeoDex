import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { db } from "@/db/db";
import { updateSettings } from "@/db/settings";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { isLocale } from "@/i18n/locales";
import { Button } from "@/ui/button";
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

  if (!learner) return <p className="p-8 text-muted-foreground">{t("common.loading")}</p>;
  const countries = scopedCountries(learner.world, learner.settings);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10">
      <h1 className="font-name text-3xl">{t("onboarding.title")}</h1>
      <LanguageSwitcher />
      <section className="flex flex-col gap-3">
        <h2 className="font-name text-xl">{t("onboarding.home")}</h2>
        <p className="text-muted-foreground">{t("onboarding.homeHelp")}</p>
        <CountryPicker countries={countries} value={home} onChange={setHome} locale={locale} />
      </section>
      <Button
        className="self-start"
        disabled={!home}
        data-testid="start-placement"
        onClick={async () => {
          if (!home) return;
          await updateSettings(db, { homeCountry: home });
          await db.placementProgress.clear();
          navigate("/placement");
        }}
      >
        {t("onboarding.start")}
      </Button>
    </div>
  );
}
