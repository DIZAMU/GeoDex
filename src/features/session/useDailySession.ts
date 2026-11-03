/**
 * Runs a daily session: intro for new countries, prompt, grading, feedback, continue.
 * The review event is written when the learner continues, so it can record both the
 * response time (prompt to answer) and the total time (prompt to continue).
 *
 * A drill runs the same loop on a given queue and logs `scheduled: false` events, so it
 * never changes card state, the schedule or the streak (PLAN.md 6.12).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { db, type ReviewEvent } from "@/db/db";
import { recordReview } from "@/db/reviews";
import type { Explanation } from "@/engine/explain/select";
import { DEFAULT_SESSION_LENGTH, type Focus, MIXED, sliceSession } from "@/engine/focus";
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
import { feedback } from "@/ui/feedback";
import { answerMoment, explain } from "../study/explain";
import { continentLookup, modeStats, planDay } from "../study/plan";
import {
  buildQuestion,
  type CheckResult,
  type Question,
  type StudyContext,
} from "../study/questions";
import type { Learner } from "../study/useLearner";

export type Outcome = CheckResult & { gaveUp: boolean; timedOut: boolean; usedHint: boolean };

export type SessionView =
  | { kind: "intro"; item: QueueItem; question: Question; explanation: Explanation }
  | { kind: "prompt"; item: QueueItem; question: Question; hint: boolean }
  | {
      kind: "feedback";
      item: QueueItem;
      question: Question;
      outcome: Outcome;
      rating: Rating;
      explanation: Explanation;
      /** Hooks voted "Not helpful" while this feedback was on screen. */
      hidden: string[];
    }
  | { kind: "done"; reviewed: number; correct: number };

/**
 * A daily session takes `length` cards in the focus from today's plan (PLAN.md 11.2); a drill
 * works through a fixed queue.
 */
export type SessionKind =
  | { kind: "daily"; length: number; focus: Focus }
  | { kind: "drill"; queue: QueueItem[] };

const DAILY: SessionKind = { kind: "daily", length: DEFAULT_SESSION_LENGTH, focus: MIXED };

export function useDailySession(
  learner: Learner,
  ctx: StudyContext | null,
  inputSetting: InputSetting,
  locale: Locale,
  kind: SessionKind = DAILY,
) {
  // Snapshot at start: the queue stays stable while the learner works through it.
  const [start] = useState(() => ({
    queue:
      kind.kind === "drill"
        ? kind.queue
        : sliceSession(
            planDay({ ...learner, now: Date.now() }).queue,
            kind.focus,
            kind.length,
            continentLookup(learner.world),
          ).queue,
    stats: modeStats(learner.events),
  }));
  const scheduled = kind.kind === "daily";

  // A picked length is a promise: learning steps that come back take the place of queue
  // cards. A bare link runs all of today, with learning steps on top, as before the picker.
  const session = useRef<SessionState>(
    startSession(
      start.queue,
      kind.kind === "daily" && !Number.isFinite(kind.length)
        ? Number.POSITIVE_INFINITY
        : start.queue.length,
    ),
  );
  const states = useRef(new Map(learner.states));
  const introduced = useRef(new Set<string>());
  /** Snippets shown on an intro panel, recorded with that card's first review. */
  const introSnippets = useRef(new Map<string, string[]>());
  const explainFor = useCallback(
    (cardId: string, moment: Parameters<typeof explain>[0]["moment"], chosenId: string | null) =>
      explain({
        world: learner.world,
        content: learner.content,
        history: { events: learner.events, votes: learner.votes, states: states.current },
        locale,
        homeCountry: learner.settings.homeCountry,
        cardId,
        moment,
        chosenId,
        reps: states.current.get(cardId)?.reps ?? 0,
      }),
    [learner, locale],
  );
  const shownAt = useRef(0);
  const answeredAt = useRef(0);
  const [view, setView] = useState<SessionView | null>(null);
  const [total] = useState(start.queue.length);
  const [reviewed, setReviewed] = useState(0);
  const correct = useRef(0);

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
      setView({ kind: "done", reviewed: session.current.answered, correct: correct.current });
      feedback("finish", learner.device);
      return;
    }
    session.current = next.state;
    const q = question(next.item);
    if (!q) return;
    const firstTime = scheduled && next.item.isNew && !states.current.has(next.item.cardId);
    if (firstTime && !introduced.current.has(next.item.entityId) && q.type === "map_to_name") {
      introduced.current.add(next.item.entityId);
      const explanation = explainFor(next.item.cardId, "introduce", null);
      introSnippets.current.set(next.item.cardId, explanation.snippetIds);
      setView({ kind: "intro", item: next.item, question: q, explanation });
      return;
    }
    shownAt.current = performance.now();
    setView({ kind: "prompt", item: next.item, question: q, hint: false });
  }, [question, explainFor, scheduled, learner.device]);

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
      // Pins are graded by distance (PLAN.md 5.3); giving up or timing out is still Again.
      const pinRating =
        result.rating !== undefined && !outcome.gaveUp && !outcome.timedOut ? result.rating : null;
      const rating =
        pinRating ??
        grade({
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
      const moment = answerMoment({
        scheduler: learner.scheduler,
        before: states.current.get(view.item.cardId),
        cardId: view.item.cardId,
        correct: result.correct,
        rating,
        now: Date.now(),
      });
      const explanation = explainFor(
        view.item.cardId,
        moment,
        result.correct ? null : result.chosenId,
      );
      setView({
        kind: "feedback",
        item: view.item,
        question: view.question,
        outcome,
        rating,
        explanation,
        hidden: [],
      });
      feedback(result.correct ? "right" : "wrong", learner.device);
    },
    [view, inputSetting, start.stats, learner.scheduler, learner.device, explainFor],
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
      snippetIds: [
        ...(introSnippets.current.get(view.item.cardId) ?? []),
        ...view.explanation.snippetIds,
      ],
      scheduled,
      locale,
      deviceId: learner.device.deviceId,
    };
    try {
      introSnippets.current.delete(view.item.cardId);
      const next = await recordReview(db, learner.scheduler, event);
      if (next) states.current.set(next.cardId, next);
      // Drill answers leave the card as it was; never requeue on its unchanged state.
      session.current = afterAnswer(
        session.current,
        view.item,
        scheduled ? next : null,
        Date.now(),
      );
      if (event.correct) correct.current++;
      setReviewed((n) => n + 1);
      return next;
    } finally {
      writing.current = false;
    }
  }, [view, inputSetting, locale, learner.device.deviceId, learner.scheduler, scheduled]);

  /** "Not helpful" (PLAN.md 6.8): hides the hook for this card for good. Append-only. */
  const notHelpful = useCallback(
    async (hookId?: string) => {
      if (view?.kind !== "feedback") return;
      const id =
        hookId ??
        view.explanation.blocks.find((b) => b.kind === "hook" && !view.hidden.includes(b.id))?.id;
      if (!id || view.hidden.includes(id)) return;
      setView({ ...view, hidden: [...view.hidden, id] });
      await db.hookVoteEvents.add({
        id: crypto.randomUUID(),
        cardId: view.item.cardId,
        hookId: id,
        createdAt: Date.now(),
        deviceId: learner.device.deviceId,
      });
    },
    [view, learner.device.deviceId],
  );

  const proceed = useCallback(async () => {
    if (view?.kind !== "feedback") return;
    await commit();
    advance();
  }, [view, commit, advance]);

  const end = useCallback(async () => {
    if (view?.kind === "feedback") await commit();
    setView({ kind: "done", reviewed: session.current.answered, correct: correct.current });
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
    notHelpful,
    proceed,
    end,
  };
}
