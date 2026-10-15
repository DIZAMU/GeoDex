import { AwardIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { type Focus, focusKey, parseFocus, sliceSession } from "@/engine/focus";
import { forecast } from "@/engine/stats";
import type { Rank } from "@/engine/xp";
import { isLocale } from "@/i18n/locales";
import { Button } from "@/ui/button";
import { achievementLabel } from "../stats/labels";
import { useLevels } from "../study/levels";
import { continentLookup, planDay } from "../study/plan";
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
  before,
  again,
}: {
  learner: Learner;
  reviewed: number;
  correct: number;
  held: ReadonlySet<string>;
  drill: boolean;
  /** Levels and XP when the session started (PLAN.md 11.3). */
  before?: { level: number; xp: number; xpLevel: number; rank: Rank };
  /** Another daily round in the same length and focus (PLAN.md 11.2). */
  again?: { length: number; focus: Focus } | null;
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
  // Today's plan after this session, for "another round" in the same focus.
  const againLength = again?.length ?? 0;
  const againFocus = again ? focusKey(again.focus) : null;
  const next = useMemo(() => {
    if (againFocus === null) return null;
    const plan = planDay({ ...learner, now: Date.now() }).queue;
    const focus = parseFocus(againFocus);
    const slice = sliceSession(plan, focus, againLength, continentLookup(learner.world));
    return slice.queue.length > 0 ? { slice, left: slice.available, focus: againFocus } : null;
  }, [againFocus, againLength, learner]);
  const levels = useLevels(learner);
  const gained = before ? Math.max(0, levels.xp.xp - before.xp) : 0;
  const levelUp = before && levels.overall.level > before.level ? levels.overall.level : null;
  const rankUp = before && levels.xp.rank !== before.rank ? levels.xp.rank : null;
  const navigate = useNavigate();
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div
        className="surface stagger flex w-full max-w-md flex-col gap-5 p-8"
        data-testid="session-summary"
      >
        {levelUp !== null || rankUp !== null ? (
          <Celebration level={levelUp} rank={rankUp ? t(`rank.${rankUp}`) : null} />
        ) : null}
        <h1 className="font-name text-3xl tracking-tight">{t("session.doneTitle")}</h1>
        <div className="flex flex-col gap-1">
          <p className="text-lg" data-testid="reviewed">
            {t("session.reviewed", { count: reviewed })}
          </p>
          {gained > 0 ? (
            <p className="font-semibold text-primary tabular-nums" data-testid="summary-xp">
              {t("summary.xp", { xp: number.format(gained) })}
            </p>
          ) : null}
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
        {next ? (
          <p className="text-muted-foreground" data-testid="summary-left">
            {t("picker.leftToday", { count: next.left })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {next ? (
            <Button
              size="lg"
              data-testid="again"
              onClick={() => {
                const params = new URLSearchParams({
                  input: learner.device.lastInputMode,
                  length: String(againLength),
                  focus: next.focus,
                });
                navigate(`/session?${params}`, { viewTransition: true });
              }}
            >
              {t("picker.again", { count: next.slice.queue.length })}
            </Button>
          ) : null}
          <Button asChild size="lg" variant={next ? "outline" : "default"}>
            <Link to={drill ? "/atlas" : "/"} viewTransition>
              {drill ? t("entry.back") : t("session.backToToday")}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

const SPARKS = 12;

/** A memory level-up or a new rank: a badge that pops and a ring of sparks, once. */
function Celebration({ level, rank }: { level: number | null; rank: string | null }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center gap-3 pb-1 text-center"
      role="status"
      data-testid="celebration"
    >
      <div className="relative flex size-24 items-center justify-center">
        {Array.from({ length: SPARKS }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative sparks
            key={i}
            aria-hidden
            className="celebrate-spark absolute top-1/2 left-1/2 -mt-1 -ml-1 size-2 rounded-full bg-primary"
            style={{ "--angle": `${(360 / SPARKS) * i}deg` } as React.CSSProperties}
          />
        ))}
        <span className="celebrate-pop flex size-24 items-center justify-center rounded-full bg-primary font-name text-4xl text-primary-foreground tabular-nums shadow-[var(--elevation)]">
          {level ?? <AwardIcon aria-hidden className="size-10" />}
        </span>
      </div>
      <p className="font-name text-xl">
        {level !== null ? t("summary.levelUp", { level }) : null}
        {level !== null && rank ? <br /> : null}
        {rank ? t("summary.rankUp", { rank }) : null}
      </p>
    </div>
  );
}
