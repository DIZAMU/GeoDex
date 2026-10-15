/**
 * Overview on Today (PLAN.md 11.3): memory level with the next milestone and the path to 10,
 * XP and rank, the daily goal, and a compact bar per topic.
 */
import { useTranslation } from "react-i18next";
import { db } from "@/db/db";
import { setLevelProgress } from "@/db/settings";
import type { FocusModule } from "@/engine/focus";
import type { MemoryLevel } from "@/engine/levels";
import { useLevels } from "../study/levels";
import type { Learner } from "../study/useLearner";
import { LevelPath } from "../welcome/LevelPath";

/** Progress through the current level, 0 to 1. */
function withinLevel(m: MemoryLevel): number {
  if (m.level >= 10) return 1;
  return Math.min(1, Math.max(0, 9 * m.share - (m.level - 1)));
}

export function Ring({
  value,
  size = 96,
  stroke = 8,
  children,
  label,
  testId,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children: React.ReactNode;
  label: string;
  testId?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      data-testid={testId}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-[stroke-dashoffset] duration-700 ease-(--ease-ui)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        {children}
      </div>
    </div>
  );
}

export function Overview({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  const levels = useLevels(learner);
  const { overall, xp, goal } = levels;
  // The way to the next level, as cards or as a share; remembered on this device.
  const showPercent = learner.device.levelProgress === "percent";
  const percent = new Intl.NumberFormat(i18n.language, {
    style: "percent",
    maximumFractionDigits: 0,
  });
  const modules = [...levels.byModule].filter(([, m]) => m.cards > 0) as [
    FocusModule,
    MemoryLevel,
  ][];
  const goalDone = Math.min(Math.floor(goal.done), goal.target);
  const goalKey = goal.kind === "minutes" ? "Minutes" : "Sessions";

  return (
    <section
      className="surface enter flex flex-col gap-5 p-5"
      aria-labelledby="overview-title"
      data-testid="overview"
      data-tour="overview"
    >
      <h2 id="overview-title" className="sr-only">
        {t("overview.title")}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 sm:justify-start">
        <Ring
          value={withinLevel(overall)}
          label={t("overview.levelLabel", { level: overall.level })}
          testId="level-ring"
        >
          <span className="text-xs text-muted-foreground">{t("overview.level")}</span>
          <span className="font-name text-3xl leading-none tabular-nums" data-testid="level">
            {number.format(overall.level)}
          </span>
        </Ring>
        {/* On a phone the text drops below the two rings, so long words never break. */}
        <div className="order-last flex min-w-0 basis-full flex-col gap-1 sm:order-none sm:flex-1 sm:basis-auto">
          <p className="font-name text-lg">{t("overview.memory")}</p>
          {overall.cardsToNext === null ? (
            <p className="text-sm text-muted-foreground" data-testid="next-level">
              {t("overview.top")}
            </p>
          ) : (
            <button
              type="button"
              className="self-start rounded-sm text-left text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              data-testid="next-level"
              data-show={showPercent ? "percent" : "cards"}
              title={t(showPercent ? "overview.showCards" : "overview.showPercent")}
              onClick={() => void setLevelProgress(db, showPercent ? "cards" : "percent")}
            >
              {showPercent
                ? t("overview.toNextPercent", {
                    percent: percent.format(withinLevel(overall)),
                    level: overall.level + 1,
                  })
                : t("overview.toNext", {
                    count: overall.cardsToNext,
                    level: overall.level + 1,
                  })}
            </button>
          )}
        </div>
        <Ring
          value={goal.target > 0 ? goal.done / goal.target : 0}
          size={72}
          stroke={6}
          label={t(`overview.goal${goalKey}Label`, { done: goalDone, count: goal.target })}
          testId="goal-ring"
        >
          <span className="font-name text-lg leading-none tabular-nums">
            {number.format(goalDone)}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">
            {t(`overview.of${goalKey}`, { count: goal.target, goal: number.format(goal.target) })}
          </span>
        </Ring>
      </div>

      <LevelPath current={overall.level} />

      <div className="flex flex-col gap-1.5" data-testid="xp">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span>
            <span className="font-semibold">{t(`rank.${xp.rank}`)}</span>
            <span className="text-muted-foreground">
              {" · "}
              {t("overview.xpLevel", { level: number.format(xp.level) })}
            </span>
          </span>
          <span
            className="text-muted-foreground tabular-nums"
            data-testid="xp-total"
            data-xp={xp.xp}
          >
            {t("overview.xp", { xp: number.format(xp.xp) })}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={t("overview.xpToNext", { xp: number.format(xp.span - xp.into) })}
          aria-valuemin={0}
          aria-valuemax={xp.span}
          aria-valuenow={xp.into}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-700 ease-(--ease-ui)"
            style={{ width: `${(xp.into / xp.span) * 100}%` }}
          />
        </div>
      </div>

      {modules.length > 1 ? (
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2" data-testid="topic-levels">
          {modules.map(([id, m]) => (
            <li key={id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{t(`picker.module.${id}`)}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {t("overview.levelShort", { level: m.level })}
                </span>
              </div>
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${m.share * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
