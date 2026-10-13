import { AwardIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { forecast } from "@/engine/stats";
import { isLocale } from "@/i18n/locales";
import { Button } from "@/ui/button";
import { achievementLabel } from "../stats/labels";
import { useProgress } from "../study/progress";
import type { Learner } from "../study/useLearner";

/**
 * End of a session (PLAN.md Phase 5): reviews done, the share correct, achievements this
 * session added, and what tomorrow holds. A drill has no tomorrow: it changed nothing.
 */
export function SessionSummary({
  learner,
  reviewed,
  correct,
  held,
  drill,
}: {
  learner: Learner;
  reviewed: number;
  correct: number;
  held: ReadonlySet<string>;
  drill: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const progress = useProgress(learner);
  const earned = progress.achievements.filter((a) => !held.has(a.id));
  const tomorrow = useMemo(
    () =>
      forecast(learner.states.values(), Date.now(), learner.settings.dayStartHour, 2)[1]?.count ??
      0,
    [learner.states, learner.settings.dayStartHour],
  );
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div
        className="surface stagger flex w-full max-w-md flex-col gap-5 p-8"
        data-testid="session-summary"
      >
        <h1 className="font-name text-3xl tracking-tight">{t("session.doneTitle")}</h1>
        <div className="flex flex-col gap-1">
          <p className="text-lg" data-testid="reviewed">
            {t("session.reviewed", { count: reviewed })}
          </p>
          {reviewed > 0 ? (
            <p className="text-muted-foreground" data-testid="summary-correct">
              {t("summary.retention", { value: percent.format(correct / reviewed) })}
            </p>
          ) : null}
          {drill ? (
            <p className="text-muted-foreground">{t("drill.note")}</p>
          ) : (
            <p className="text-muted-foreground" data-testid="summary-tomorrow">
              {t("summary.tomorrow", { count: tomorrow })}
            </p>
          )}
        </div>
        {earned.length > 0 ? (
          <section aria-labelledby="new-achievements" className="flex flex-col gap-2">
            <h2 id="new-achievements" className="font-name text-lg">
              {t("summary.newAchievements")}
            </h2>
            <ul className="flex flex-col gap-1.5" data-testid="summary-achievements">
              {earned.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <AwardIcon aria-hidden className="size-4 shrink-0 text-primary" />
                  {achievementLabel(a, learner.world, locale, t)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <Button asChild size="lg" className="self-start">
          <Link to={drill ? "/atlas" : "/"} viewTransition>
            {drill ? t("entry.back") : t("session.backToToday")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
