/**
 * Runs a daily session: intro for new countries, prompt, grading, feedback, continue.
 * The review event is written when the learner continues, so it can record both the
 * response time (prompt to answer) and the total time (prompt to continue).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { db, type ReviewEvent } from "@/db/db";
import { recordReview } from "@/db/reviews";
import { grade } from "@/engine/grading";
import type { CardState } from "@/engine/scheduler";
import {
  afterAnswer,
  nextItem,
  type QueueItem,
  remaining,
  type SessionState,
  startSession,
} from "@/engine/session";
import type { InputSetting, Rating } from "@/engine/types";
import type { Locale } from "@/i18n/locales";
import { modeStats, planDay } from "../study/plan";
import {
  buildQuestion,
  type CheckResult,
  type Question,
  type StudyContext,
} from "../study/questions";
import type { Learner } from "../study/useLearner";

export type Outcome = CheckResult & { gaveUp: boolean; timedOut: boolean; usedHint: boolean };

export type SessionView =
  | { kind: "intro"; item: QueueItem; question: Question }
  | { kind: "prompt"; item: QueueItem; question: Question; hint: boolean }
  | { kind: "feedback"; item: QueueItem; question: Question; outcome: Outcome; rating: Rating }
  | { kind: "done"; reviewed: number };

export function useDailySession(
  learner: Learner,
  ctx: StudyContext | null,
  inputSetting: InputSetting,
  locale: Locale,
) {
  // Snapshot at start: the queue stays stable while the learner works through it.
  const [start] = useState(() => ({
    plan: planDay({ ...learner, now: Date.now() }),
    stats: modeStats(learner.events),
  }));

  const session = useRef<SessionState>(startSession(start.plan.queue));
  const states = useRef(new Map(learner.states));
  const introduced = useRef(new Set<string>());
  const shownAt = useRef(0);
  const answeredAt = useRef(0);
  const [view, setView] = useState<SessionView | null>(null);
  const [total] = useState(start.plan.queue.length);
  const [reviewed, setReviewed] = useState(0);

  const question = useCallback(
    (item: QueueItem): Question | null => {
      if (!ctx) return null;
      const state = states.current.get(item.cardId);
      return buildQuestion(
        ctx,
        item.cardId,
        state,
        inputSetting,
        `${item.cardId}#${state?.reps ?? 0}`,
      );
    },
    [ctx, inputSetting],
  );

  const advance = useCallback(() => {
    const next = nextItem(session.current, Date.now());
    if (!next) {
      setView({ kind: "done", reviewed: session.current.answered });
      return;
    }
    session.current = next.state;
    const q = question(next.item);
    if (!q) return;
    const firstTime = next.item.isNew && !states.current.has(next.item.cardId);
    if (firstTime && !introduced.current.has(next.item.entityId) && q.type === "map_to_name") {
      introduced.current.add(next.item.entityId);
      setView({ kind: "intro", item: next.item, question: q });
      return;
    }
    shownAt.current = performance.now();
    setView({ kind: "prompt", item: next.item, question: q, hint: false });
  }, [question]);

  useEffect(() => {
    if (view === null && ctx) advance();
  }, [view, ctx, advance]);

  const startPrompt = useCallback(() => {
    if (view?.kind !== "intro") return;
    shownAt.current = performance.now();
    setView({ kind: "prompt", item: view.item, question: view.question, hint: false });
  }, [view]);

  const showHint = useCallback(() => {
    if (view?.kind === "prompt") setView({ ...view, hint: true });
  }, [view]);

  const answer = useCallback(
    (result: CheckResult, how: { gaveUp?: boolean; timedOut?: boolean } = {}) => {
      if (view?.kind !== "prompt") return;
      answeredAt.current = performance.now();
      const responseMs = Math.round(answeredAt.current - shownAt.current);
      const outcome: Outcome = {
        ...result,
        gaveUp: how.gaveUp ?? false,
        timedOut: how.timedOut ?? false,
        usedHint: view.hint,
      };
      const stats = start.stats.get(view.question.mode);
      const rating = grade({
        correct: result.correct,
        gaveUp: outcome.gaveUp || outcome.timedOut,
        usedHint: outcome.usedHint,
        typo: result.typo,
        responseMs,
        mode: view.question.mode,
        inputSetting,
        medianMs: stats?.median ?? null,
        reviewsInMode: stats?.count ?? 0,
      });
      setView({ kind: "feedback", item: view.item, question: view.question, outcome, rating });
    },
    [view, inputSetting, start.stats],
  );

  const writing = useRef(false);
  const commit = useCallback(async (): Promise<CardState | null> => {
    if (view?.kind !== "feedback" || writing.current) return null;
    writing.current = true;
    const now = performance.now();
    const event: ReviewEvent = {
      id: crypto.randomUUID(),
      cardId: view.item.cardId,
      reviewedAt: Date.now(),
      rating: view.rating,
      mode: view.question.mode,
      inputSetting,
      correct: view.outcome.correct,
      chosenAnswer: view.outcome.correct ? null : view.outcome.chosenId,
      responseMs: Math.round(answeredAt.current - shownAt.current),
      durationMs: Math.round(now - shownAt.current),
      snippetIds: [],
      scheduled: true,
      locale,
      deviceId: learner.device.deviceId,
      synced: 0,
    };
    try {
      const next = await recordReview(db, learner.scheduler, event);
      if (next) states.current.set(next.cardId, next);
      session.current = afterAnswer(session.current, view.item, next, Date.now());
      setReviewed((n) => n + 1);
      return next;
    } finally {
      writing.current = false;
    }
  }, [view, inputSetting, locale, learner.device.deviceId, learner.scheduler]);

  const proceed = useCallback(async () => {
    if (view?.kind !== "feedback") return;
    await commit();
    advance();
  }, [view, commit, advance]);

  const end = useCallback(async () => {
    if (view?.kind === "feedback") await commit();
    setView({ kind: "done", reviewed: session.current.answered });
  }, [view, commit]);

  return {
    view,
    ctx,
    left:
      view?.kind === "done" ? 0 : remaining(session.current) + (view?.kind === "feedback" ? 0 : 1),
    total,
    reviewed,
    startPrompt,
    showHint,
    answer,
    proceed,
    end,
  };
}
