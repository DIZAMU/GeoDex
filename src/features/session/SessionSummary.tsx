import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { type Focus, focusKey, parseFocus, sliceSession } from "@/engine/focus";
import { forecast } from "@/engine/stats";
import { parseCardId } from "@/engine/types";
import type { Rank } from "@/engine/xp";
import { isLocale } from "@/i18n/locales";
import { Button } from "@/ui/button";
import { achievementLabel } from "../stats/labels";
import { useLevels } from "../study/levels";
import { continentLookup, planDay } from "../study/plan";
import { useProgress } from "../study/progress";
import type { Learner } from "../study/useLearner";
import { nameOf } from "./parts";

/**
 * End of a session: how many were right, then what slipped and what it was
 * mixed up with, XP, achievements and tomorrow. A drill has no tomorrow: it changed nothing.
 */
export function SessionSummary({
  learner,
  reviewed,
  correct,
  results = [],
  held,
  drill,
  before,
  startedAt,
  again,
}: {
  learner: Learner;
  reviewed: number;
  correct: number;
  /** Each answer in order, right or wrong. */
  results?: readonly boolean[];
  held: ReadonlySet<string>;
  drill: boolean;
  /** Levels and XP when the session started. */
  before?: { level: number; xp: number; xpLevel: number; rank: Rank };
  /** When the session started; the answers since then are this session's. */
  startedAt?: number;
  /** Another daily round in the same length and focus. */
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
  // What slipped: each entity answered wrong in this session, once, with what was chosen.
  const misses = useMemo(() => {
    if (startedAt === undefined) return [];
    const seen = new Set<string>();
    const out: { id: string; name: string; chosen: string | null }[] = [];
    for (const e of learner.events) {
      if (e.reviewedAt < startedAt || e.correct) continue;
      const { entityId } = parseCardId(e.cardId);
      if (seen.has(entityId)) continue;
      seen.add(entityId);
      const chosen =
        e.chosenAnswer && e.chosenAnswer !== entityId && learner.world.byId.has(e.chosenAnswer)
          ? nameOf(learner.world, e.chosenAnswer, locale)
          : null;
      out.push({ id: entityId, name: nameOf(learner.world, entityId, locale), chosen });
    }
    return out.slice(0, 6);
  }, [learner.events, learner.world, startedAt, locale]);
  const gained = before ? Math.max(0, levels.xp.xp - before.xp) : 0;
  const levelUp = before && levels.overall.level > before.level ? levels.overall.level : null;
  const rankUp = before && levels.xp.rank !== before.rank ? levels.xp.rank : null;
  const navigate = useNavigate();
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="enter flex w-full max-w-md flex-col gap-6" data-testid="session-summary">
        {levelUp !== null || rankUp !== null ? (
          <Celebration level={levelUp} rank={rankUp ? t(`rank.${rankUp}`) : null} />
        ) : null}
        <div className="flex flex-col gap-1">
          {results.length > 0 ? <ResultDots results={results} /> : null}
          <h1 className="text-3xl font-medium tracking-tight" data-testid="summary-correct">
            {t("summary.right", {
              correct: number.format(correct),
              count: reviewed,
              total: number.format(reviewed),
            })}
          </h1>
          <p className="text-muted-foreground" data-testid="reviewed">
            {t("session.reviewed", { count: reviewed })}
            {reviewed > 0 ? `, ${percent.format(correct / reviewed)}` : null}
            {gained > 0 ? (
              <>
                {", "}
                <span className="text-foreground tabular-nums" data-testid="summary-xp">
                  {t("summary.xp", { xp: number.format(gained) })}
                </span>
              </>
            ) : null}
          </p>
          {drill ? (
            <p className="text-muted-foreground">{t("drill.note")}</p>
          ) : (
            <p className="text-muted-foreground" data-testid="summary-tomorrow">
              {t("summary.tomorrow", { count: tomorrow })}
            </p>
          )}
        </div>
        {misses.length > 0 ? (
          <section aria-labelledby="misses-title" className="flex flex-col gap-1">
            <h2 id="misses-title" className="text-sm text-muted-foreground">
              {t("summary.misses")}
            </h2>
            <ul data-testid="summary-misses">
              {misses.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-border py-2.5"
                >
                  <span>{m.name}</span>
                  {m.chosen ? (
                    <span className="text-sm text-muted-foreground">
                      {t("summary.mixedUp", { name: m.chosen })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {earned.length > 0 ? (
          <section aria-labelledby="new-achievements" className="flex flex-col gap-2">
            <h2 id="new-achievements" className="text-sm text-muted-foreground">
              {t("summary.newAchievements")}
            </h2>
            <ul className="flex flex-col gap-1.5" data-testid="summary-achievements">
              {earned.map((a) => (
                <li key={a.id}>{achievementLabel(a, learner.world, locale, t)}</li>
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
          <Button asChild size="lg" variant={next ? "ghost" : "default"}>
            {/* Today opens "Good job!" when this session finished the day. */}
            <Link
              to={drill ? "/atlas" : "/"}
              state={drill ? undefined : { finished: true }}
              viewTransition
            >
              {drill ? t("entry.back") : t("session.backToToday")}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

/**
 * One dot per answer, in order: filled for right, hollow red for wrong, so the shape of the
 * session shows at a glance. They pop in one after another. The heading says the same in words.
 */
function ResultDots({ results }: { results: readonly boolean[] }) {
  return (
    <ol aria-hidden className="flex flex-wrap gap-1.5 pb-3" data-testid="summary-dots">
      {results.map((right, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: answers have no id but their order
          key={i}
          data-right={right}
          className={`summary-dot size-3.5 rounded-full ${
            right ? "bg-correct" : "border-2 border-destructive"
          }`}
          // The stagger stops growing after 16 dots so a long session still fills quickly.
          style={{ animationDelay: `${Math.min(i, 16) * 45}ms` }}
        />
      ))}
    </ol>
  );
}

/** Stand-in for the results while the last answer is saved: the summary's shape, shimmering. */
export function SummarySkeleton() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="flex w-full max-w-md flex-col gap-6"
        data-testid="summary-loading"
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5 pb-1">
            {Array.from({ length: 5 }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
              <div key={i} className="skeleton size-3.5 rounded-full" />
            ))}
          </div>
          <div className="skeleton h-9 w-56" />
          <div className="skeleton h-4 w-64" />
          <div className="skeleton h-4 w-44" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
        </div>
        <div className="flex gap-3">
          <div className="skeleton h-11 w-40" />
          <div className="skeleton h-11 w-32" />
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
            className="celebrate-spark absolute top-1/2 left-1/2 -mt-1 -ml-1 size-1.5 rounded-full bg-foreground"
            style={{ "--angle": `${(360 / SPARKS) * i}deg` } as React.CSSProperties}
          />
        ))}
        <span className="celebrate-pop flex size-20 items-center justify-center rounded-full border-2 border-foreground text-3xl font-medium tabular-nums">
          {level ?? rankInitial(rank)}
        </span>
      </div>
      <p className="text-lg font-medium">
        {level !== null ? t("summary.levelUp", { level }) : null}
        {level !== null && rank ? <br /> : null}
        {rank ? t("summary.rankUp", { rank }) : null}
      </p>
    </div>
  );
}

/** The first letter of a rank, for the badge when only the rank changed. */
function rankInitial(rank: string | null): string {
  return rank ? rank.slice(0, 1).toUpperCase() : "";
}
