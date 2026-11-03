/**
 * The level on Today (docs/PLAN-2.0.md): one bar for the memory level, one line for rank and
 * XP, one for the daily goal. The full breakdown lives in Stats.
 */
import { useTranslation } from "react-i18next";
import { db } from "@/db/db";
import { setLevelProgress } from "@/db/settings";
import type { MemoryLevel } from "@/engine/levels";
import { useLevels } from "../study/levels";
import type { Learner } from "../study/useLearner";

/** Progress through the current level, 0 to 1. */
export function withinLevel(m: MemoryLevel): number {
  if (m.level >= 10) return 1;
  return Math.min(1, Math.max(0, 9 * m.share - (m.level - 1)));
}

export function LevelLine({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const { overall, xp, goal } = useLevels(learner);
  // The way to the next level, as cards or as a share; remembered on this device.
  const showPercent = learner.device.levelProgress === "percent";
  const within = withinLevel(overall);
  const goalDone = Math.min(Math.floor(goal.done), goal.target);
  const goalLabel =
    goal.kind === "minutes"
      ? t("overview.goalMinutesLabel", { done: goalDone, count: goal.target })
      : t("overview.goalSessionsLabel", { done: goalDone, count: goal.target });

  return (
    <section
      className="flex flex-col gap-2"
      aria-labelledby="level-title"
      data-testid="overview"
      data-tour="overview"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="level-title" className="font-medium">
          {t("overview.level")} <span data-testid="level">{number.format(overall.level)}</span>
        </h2>
        {overall.cardsToNext === null ? (
          <p className="text-sm text-muted-foreground" data-testid="next-level">
            {t("overview.top")}
          </p>
        ) : (
          <button
            type="button"
            className="rounded-sm text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            data-testid="next-level"
            data-show={showPercent ? "percent" : "cards"}
            title={t(showPercent ? "overview.showCards" : "overview.showPercent")}
            onClick={() => void setLevelProgress(db, showPercent ? "cards" : "percent")}
          >
            {showPercent
              ? t("overview.toNextPercent", {
                  percent: percent.format(within),
                  level: overall.level + 1,
                })
              : t("overview.toNext", { count: overall.cardsToNext, level: overall.level + 1 })}
          </button>
        )}
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={t("overview.levelLabel", { level: overall.level })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(within * 100)}
        data-testid="level-ring"
      >
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-500 ease-(--ease-ui)"
          style={{ width: `${within * 100}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground" data-testid="xp">
        <span className="text-foreground">{t(`rank.${xp.rank}`)}</span>
        {", "}
        <span data-testid="xp-total" data-xp={xp.xp}>
          {t("overview.xp", { xp: number.format(xp.xp) })}
        </span>
      </p>
      <p className="text-sm text-muted-foreground" data-testid="goal-ring">
        {goalLabel}
      </p>
    </section>
  );
}
