import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { db } from "@/db/db";
import { setLastInputMode } from "@/db/settings";
import type { InputSetting } from "@/engine/types";
import { isLocale } from "@/i18n/locales";
import { Button } from "@/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import { planDay } from "../study/plan";
import { useLearner } from "../study/useLearner";

const INPUTS: readonly InputSetting[] = ["auto", "mc", "typing"];

export function TodayScreen() {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const learner = useLearner();
  const navigate = useNavigate();
  const plan = useMemo(
    () => (learner?.settings.homeCountry ? planDay({ ...learner, now: Date.now() }) : null),
    [learner],
  );

  if (!learner) return <p className="p-8 text-muted-foreground">{t("common.loading")}</p>;

  const needsSetup =
    !learner.settings.homeCountry || learner.settings.placementCompletedAt === null;
  const input = learner.device.lastInputMode;
  const region = plan?.nextSubregion
    ? learner.world.subregions.find((s) => s.id === plan.nextSubregion)?.names[locale]
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 md:px-10 md:py-16">
      <section aria-labelledby="today-title" className="flex flex-col gap-4">
        <h1 id="today-title" className="font-name text-3xl md:text-4xl">
          {t("today.title")}
        </h1>
        {needsSetup ? (
          <>
            <p className="max-w-[60ch] text-lg text-muted-foreground">{t("today.setupBody")}</p>
            <Button asChild className="self-start" data-testid="setup">
              <Link to={learner.settings.homeCountry ? "/placement" : "/onboarding"}>
                {t("today.setup")}
              </Link>
            </Button>
          </>
        ) : plan ? (
          <>
            <p className="text-lg" data-testid="summary">
              {plan.queue.length > 0
                ? t("today.summary", {
                    reviews: t("today.reviews", { count: plan.dueCount }),
                    newCards: t("today.newCards", { count: plan.newCount }),
                    minutes: Math.max(1, plan.budget.estimatedMinutes),
                  })
                : t("today.nothingLeft")}
            </p>
            {plan.budget.paused ? (
              <p className="text-muted-foreground">{t("today.paused")}</p>
            ) : null}
            {region ? (
              <p className="text-muted-foreground">{t("today.nextRegion", { name: region })}</p>
            ) : null}
          </>
        ) : null}
      </section>

      {!needsSetup && plan && plan.queue.length > 0 ? (
        <section className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted-foreground">{t("today.inputMode")}</legend>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={input}
              onValueChange={(value) => {
                if (INPUTS.includes(value as InputSetting))
                  void setLastInputMode(db, value as InputSetting);
              }}
            >
              {INPUTS.map((mode) => (
                <ToggleGroupItem key={mode} value={mode} data-testid={`input-${mode}`}>
                  {t(`input.${mode}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>
          <Button
            className="self-start"
            size="lg"
            data-testid="start"
            onClick={() => navigate(`/session?input=${input}`)}
          >
            {t("today.start")}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
