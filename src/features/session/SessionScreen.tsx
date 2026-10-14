import { XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import type { HistoricalEntity } from "@/data/types";
import type { InputSetting } from "@/engine/types";
import { isLocale } from "@/i18n/locales";
import { type MapFocus, type MapHighlight, WorldMap } from "@/map/WorldMap";
import { Button } from "@/ui/button";
import { useFocusOnMount } from "@/ui/focus";
import { Loader } from "@/ui/loader";
import { useStudyContext } from "../study/context";
import { confusionScoresFor, scopedCountries } from "../study/plan";
import { computeProgress } from "../study/progress";
import {
  checkChoice,
  checkPin,
  checkTaps,
  checkTyped,
  featureView,
  type MapView,
  outlineView,
  type Question,
  type StudyContext,
  scopedMembers,
} from "../study/questions";
import { type Learner, useLearner } from "../study/useLearner";
import { ExplanationView } from "./ExplanationView";
import {
  ChoiceAnswer,
  CityCard,
  CountryCard,
  FeatureCard,
  FlagAnswer,
  formatPeriod,
  GroupCard,
  HistoryCard,
  LandmarkCard,
  nameOf,
  OutlineCaption,
  PromptText,
  StatusLine,
  TapAnswer,
  TypedAnswer,
  useSessionKeys,
} from "./parts";
import { SessionSummary } from "./SessionSummary";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { CountdownRing, ProgressBar, StudyLayout } from "./StudyLayout";
import { useCountdown } from "./useCountdown";
import { type SessionKind, type SessionView, useDailySession } from "./useDailySession";

const INPUTS: readonly InputSetting[] = ["auto", "mc", "typing"];
const EMPTY: ReadonlySet<string> = new Set();

export function SessionScreen() {
  const learner = useLearner();
  const [params] = useSearchParams();
  const requested = params.get("input");
  const input = INPUTS.includes(requested as InputSetting)
    ? (requested as InputSetting)
    : (learner?.device.lastInputMode ?? "auto");
  if (!learner) return <Loader />;
  return <Session learner={learner} input={input} />;
}

export function Session({
  learner,
  input,
  kind,
}: {
  learner: Learner;
  input: InputSetting;
  kind?: SessionKind;
}) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const navigate = useNavigate();
  // Confusion scores are fixed for the session, like the queue.
  const [scores] = useState(() => confusionScoresFor(learner.world, learner.events, Date.now()));
  const scoped = useMemo(
    () => scopedCountries(learner.world, learner.settings),
    [learner.world, learner.settings],
  );
  const selectable = useMemo(() => new Set(scoped.map((c) => c.id)), [scoped]);
  const ctx = useStudyContext(learner.world, locale, scores, learner.content, selectable);
  const s = useDailySession(learner, ctx, input, locale, kind);
  // Achievements held at the start, so the summary can show what this session added.
  const [held] = useState(
    () => new Set(computeProgress(learner, Date.now()).achievements.map((a) => a.id)),
  );
  const [help, setHelp] = useState(false);
  const countdownSeconds = learner.settings.countdownSeconds;
  const view = s.view;

  const timeLeft = useCountdown(
    view?.kind === "prompt" ? countdownSeconds : 0,
    view?.kind === "prompt" ? view.question.cardId : null,
    () => s.answer({ correct: false, typo: false, chosenId: null }, { timedOut: true }),
  );

  // Tap answers: the countries picked so far for the current card.
  const [taps, setTaps] = useState<{ cardId: string; ids: ReadonlySet<string> }>({
    cardId: "",
    ids: new Set(),
  });
  const tapQuestion =
    view?.kind === "prompt" && view.question.answer.kind === "taps" ? view.question : null;
  const picked = tapQuestion && taps.cardId === tapQuestion.cardId ? taps.ids : EMPTY;
  const toggleTap = (id: string) => {
    if (!tapQuestion) return;
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTaps({ cardId: tapQuestion.cardId, ids: next });
  };
  const submitTaps = () => {
    if (tapQuestion && picked.size > 0) s.answer(checkTaps(tapQuestion, picked));
  };

  const options =
    view?.kind === "prompt" &&
    (view.question.answer.kind === "choice" || view.question.answer.kind === "flags")
      ? view.question.answer.options
      : [];

  useSessionKeys({
    choose: (index) => {
      const option = options[index];
      if (option && view?.kind === "prompt") s.answer(checkChoice(view.question, option.id));
    },
    proceed:
      view?.kind === "feedback"
        ? () => void s.proceed()
        : view?.kind === "intro"
          ? s.startPrompt
          : tapQuestion
            ? submitTaps
            : undefined,
    hint: view?.kind === "prompt" && view.question.answer.kind === "typed" ? s.showHint : undefined,
    notHelpful: view?.kind === "feedback" ? () => void s.notHelpful() : undefined,
    end: () => void s.end(),
    help: () => setHelp(true),
  });

  const allFeatures = useMemo(
    () => new Set(learner.world.physical.map((f) => f.id)),
    [learner.world.physical],
  );
  const labelFor = useCallback(
    (id: string) => nameOf(learner.world, id, locale),
    [learner.world, locale],
  );

  useEffect(() => {
    if (view?.kind === "done" && view.reviewed === 0) navigate("/", { viewTransition: true });
  }, [view, navigate]);

  if (!view || !s.ctx) return <Loader />;
  if (view.kind === "done") {
    return (
      <SessionSummary
        learner={learner}
        reviewed={view.reviewed}
        correct={view.correct}
        held={held}
        drill={kind?.kind === "drill"}
      />
    );
  }

  const { focus, highlight, animate, padding } = mapState(view, learner, locale, s.ctx, picked);
  const outlines = historyOutlines(view, learner);
  const past = view.question.historyId
    ? learner.world.historyById.get(view.question.historyId)
    : undefined;
  const mapSelectable =
    view.kind === "prompt" && view.question.answer.kind === "map"
      ? view.question.answer.selectable
        ? new Set(view.question.answer.selectable)
        : selectable
      : tapQuestion
        ? selectable
        : undefined;

  return (
    <>
      <StudyLayout
        top={
          <div className="flex items-center gap-2 pr-2">
            <div className="flex-1">
              <ProgressBar
                done={s.reviewed}
                total={s.total}
                label={t("session.left", { count: s.left })}
              />
            </div>
            {timeLeft !== null ? (
              <CountdownRing
                left={timeLeft}
                total={countdownSeconds}
                label={t("session.countdown", { count: timeLeft })}
              />
            ) : null}
            <Button variant="ghost" onClick={() => void s.end()}>
              <XIcon aria-hidden />
              {t("session.end")}
            </Button>
          </div>
        }
        map={
          <WorldMap
            countries={scoped}
            topology={learner.world.topology}
            focus={focus}
            highlight={highlight}
            selectable={mapSelectable}
            onSelect={(id) =>
              tapQuestion
                ? toggleTap(id)
                : view.kind === "prompt" && s.answer(checkChoice(view.question, id))
            }
            onPin={
              view.kind === "prompt" && view.question.answer.kind === "pin"
                ? (at) => s.answer(checkPin(view.question, at))
                : undefined
            }
            labelFor={labelFor}
            physical={view.question.featureId ? learner.world.physical : undefined}
            selectableFeatures={
              view.kind === "prompt" && view.question.answer.kind === "feature"
                ? allFeatures
                : undefined
            }
            history={outlines}
            caption={
              past && outlines?.some((e) => e.id === past.id) ? (
                <OutlineCaption entity={past} />
              ) : undefined
            }
            ariaLabel={t("map.label")}
            animate={animate}
            padding={padding}
          />
        }
        panel={
          // Each new step rises in; the key restarts the entrance.
          <div key={`${view.kind}:${view.item.cardId}`} className="enter">
            <Panel
              view={view}
              ctx={s.ctx}
              session={s}
              learner={learner}
              locale={locale}
              tapCount={picked.size}
              onCheckTaps={submitTaps}
            />
          </div>
        }
      />
      <ShortcutsDialog open={help} onOpenChange={setHelp} />
    </>
  );
}

function Panel({
  view,
  ctx,
  session: s,
  learner,
  locale,
  tapCount,
  onCheckTaps,
}: {
  view: Exclude<SessionView, { kind: "done" }>;
  ctx: StudyContext;
  session: ReturnType<typeof useDailySession>;
  learner: Learner;
  locale: "en" | "nb";
  tapCount: number;
  onCheckTaps: () => void;
}) {
  const { t } = useTranslation();
  const focusOnMount = useFocusOnMount<HTMLButtonElement>();
  // Physical cards may border no country in scope (the Southern Ocean). Their panel never
  // shows country details, so any country stands in to keep the shared code simple.
  const country =
    learner.world.byId.get(view.question.countryId) ??
    (view.question.featureId || view.question.historyId ? learner.world.countries[0] : undefined);
  if (!country) return null;
  const past = view.question.historyId
    ? learner.world.historyById.get(view.question.historyId)
    : undefined;
  const city = learner.world.cityById.get(view.question.entityId);
  const landmark = learner.world.landmarkById.get(view.question.entityId);
  const physical = view.question.featureId
    ? learner.world.physicalById.get(view.question.featureId)
    : undefined;
  const group = view.question.groupId
    ? learner.world.groupById.get(view.question.groupId)
    : undefined;

  if (view.kind === "intro") {
    return (
      <div className="flex flex-col gap-6" data-testid="intro">
        <p className="text-sm text-muted-foreground">{t("intro.label")}</p>
        <CountryCard country={country} locale={locale} />
        <ExplanationView explanation={view.explanation} />
        <Button size="lg" className="self-start" onClick={s.startPrompt} ref={focusOnMount}>
          {t("intro.continue")}
        </Button>
      </div>
    );
  }

  const q = view.question;
  if (view.kind === "prompt") {
    const answer = q.answer;
    const hintText = (() => {
      if (!view.hint) return null;
      const target =
        q.answerKind === "group"
          ? (group?.names[locale] ?? "")
          : q.answerKind === "landmark"
            ? (landmark?.names[locale] ?? "")
            : q.answerKind === "feature"
              ? (physical?.names[locale] ?? "")
              : q.answerKind === "capital"
                ? (country.capitals.find((c) => c.roles.includes("primary"))?.names[locale] ?? "")
                : q.answerKind === "currency"
                  ? (country.currencies[0]?.names[locale] ?? "")
                  : q.answerKind === "language"
                    ? (country.officialLanguages[0]?.names[locale] ?? "")
                    : country.names[locale];
      return t("answer.hintStarts", {
        letter: target.charAt(0).toUpperCase(),
        count: target.replace(/\s/g, "").length,
      });
    })();
    return (
      <div className="flex flex-col gap-4 lg:gap-6">
        <PromptText question={q} world={learner.world} locale={locale} />
        {answer.kind === "choice" ? (
          <ChoiceAnswer options={answer.options} onPick={(id) => s.answer(checkChoice(q, id))} />
        ) : answer.kind === "flags" ? (
          <FlagAnswer options={answer.options} onPick={(id) => s.answer(checkChoice(q, id))} />
        ) : answer.kind === "taps" ? (
          <TapAnswer
            count={tapCount}
            onCheck={onCheckTaps}
            onGiveUp={() =>
              s.answer({ correct: false, typo: false, chosenId: null }, { gaveUp: true })
            }
          />
        ) : answer.kind === "typed" ? (
          <TypedAnswer
            key={q.cardId}
            onSubmit={(text) => s.answer(checkTyped(q, ctx.indexes, text))}
            hint={hintText}
            onHint={s.showHint}
            onGiveUp={() =>
              s.answer({ correct: false, typo: false, chosenId: null }, { gaveUp: true })
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground">
              {answer.kind === "pin"
                ? landmark
                  ? t("answer.pinHelpLandmark")
                  : t("answer.pinHelp")
                : answer.kind === "feature"
                  ? t("answer.featureHelp")
                  : t("answer.mapHelp")}
            </p>
            <Button
              variant="outline"
              data-testid="give-up"
              className="self-start"
              onClick={() =>
                s.answer({ correct: false, typo: false, chosenId: null }, { gaveUp: true })
              }
            >
              {t("answer.giveUp")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Feedback (PLAN.md 7.1). Moment content arrives with the explanation engine in Phase 3.
  const o = view.outcome;
  if (group)
    return <GroupFeedback view={view} ctx={ctx} session={s} learner={learner} locale={locale} />;
  const chosenCountry = !o.correct && o.chosenId ? learner.world.byId.get(o.chosenId) : undefined;
  const chosenPast = o.chosenId ? learner.world.historyById.get(o.chosenId) : undefined;
  const chosenLabel =
    q.answerKind === "era" && chosenPast && chosenPast.kind === "empire"
      ? formatPeriod(chosenPast.period, t)
      : (chosenPast?.names[locale] ??
        chosenCountry?.names[locale] ??
        (o.chosenId
          ? (learner.world.countries.flatMap((c) => c.capitals).find((c) => c.id === o.chosenId)
              ?.names[locale] ??
            learner.world.cityById.get(o.chosenId)?.names[locale] ??
            learner.world.landmarkById.get(o.chosenId)?.names[locale] ??
            learner.world.physicalById.get(o.chosenId)?.names[locale] ??
            learner.world.languageNames[o.chosenId]?.[locale] ??
            learner.world.countries.flatMap((c) => c.currencies).find((c) => c.code === o.chosenId)
              ?.names[locale] ??
            null)
          : null));
  // Wrong picks of a country or capital are described by the moment template instead.
  const pickedPlace =
    !!o.chosenId &&
    (learner.world.byId.has(o.chosenId) ||
      learner.world.countries.some((c) => c.capitals.some((cap) => cap.id === o.chosenId)));
  return (
    <div className="flex flex-col gap-5" data-testid="feedback">
      <StatusLine correct={o.correct} />
      {o.timedOut ? <p>{t("feedback.timeUp")}</p> : o.gaveUp ? <p>{t("feedback.gaveUp")}</p> : null}
      {!o.correct && chosenLabel && !pickedPlace ? (
        <p>{t("feedback.youPicked", { name: chosenLabel })}</p>
      ) : null}
      {o.correct && o.typo && o.matched ? (
        <p>{t("feedback.spelling", { name: o.matched })}</p>
      ) : null}
      {past ? (
        <HistoryCard entity={past} world={learner.world} locale={locale} />
      ) : physical ? (
        <FeatureCard feature={physical} world={learner.world} locale={locale} />
      ) : landmark ? (
        <LandmarkCard
          landmark={landmark}
          country={country}
          locale={locale}
          distanceKm={o.distanceKm}
        />
      ) : city && q.type !== "contrast" ? (
        <CityCard city={city} country={country} locale={locale} distanceKm={o.distanceKm} />
      ) : (
        <CountryCard country={country} locale={locale} />
      )}
      {q.answerKind === "currency" ? (
        <p>
          {t("feedback.currency")}:{" "}
          {country.currencies.map((c) => `${c.names[locale]} (${c.code})`).join(", ")}
        </p>
      ) : null}
      {q.answerKind === "language" ? (
        <p>
          {t("feedback.languages")}:{" "}
          {country.officialLanguages.map((l) => l.names[locale]).join(", ")}
        </p>
      ) : null}
      <ExplanationView
        explanation={view.explanation}
        hidden={view.hidden}
        onNotHelpful={(id) => void s.notHelpful(id)}
      />
      <Button
        size="lg"
        className="self-start"
        onClick={() => void s.proceed()}
        ref={focusOnMount}
        data-testid="continue"
      >
        {t("feedback.continue")}
      </Button>
    </div>
  );
}

/** A group's members and disputed members for a question, as studied. */
function groupMembers(q: Question, ctx: StudyContext | null) {
  if (q.answer.kind === "taps") return { members: q.answer.members, sometimes: q.answer.sometimes };
  return ctx && q.groupId ? scopedMembers(ctx, q.groupId) : { members: [], sometimes: [] };
}

function GroupFeedback({
  view,
  ctx,
  session: s,
  learner,
  locale,
}: {
  view: Extract<SessionView, { kind: "feedback" }>;
  ctx: StudyContext;
  session: ReturnType<typeof useDailySession>;
  learner: Learner;
  locale: "en" | "nb";
}) {
  const { t } = useTranslation();
  const focusOnMount = useFocusOnMount<HTMLButtonElement>();
  const q = view.question;
  const o = view.outcome;
  const group = q.groupId ? learner.world.groupById.get(q.groupId) : undefined;
  if (!group) return null;
  const { members, sometimes } = groupMembers(q, ctx);
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const names = (ids: readonly string[]) =>
    list.format(ids.map((id) => nameOf(learner.world, id, locale)));
  const picked =
    !o.correct && o.chosenId
      ? (learner.world.groupById.get(o.chosenId)?.names[locale] ??
        learner.world.byId.get(o.chosenId)?.names[locale])
      : undefined;
  return (
    <div className="flex flex-col gap-5" data-testid="feedback">
      <StatusLine correct={o.correct} />
      {o.timedOut ? <p>{t("feedback.timeUp")}</p> : o.gaveUp ? <p>{t("feedback.gaveUp")}</p> : null}
      {o.taps && o.taps.missed.length > 0 ? (
        <p data-testid="taps-missed">{t("feedback.missed", { names: names(o.taps.missed) })}</p>
      ) : null}
      {o.taps && o.taps.wrong.length > 0 ? (
        <p data-testid="taps-wrong">{t("feedback.notInGroup", { names: names(o.taps.wrong) })}</p>
      ) : null}
      {!o.taps && picked ? <p>{t("feedback.youPicked", { name: picked })}</p> : null}
      {o.correct && o.typo && o.matched ? (
        <p>{t("feedback.spelling", { name: o.matched })}</p>
      ) : null}
      <GroupCard
        group={group}
        members={members}
        sometimes={sometimes}
        world={learner.world}
        locale={locale}
      />
      {q.type === "group_to_map" && sometimes.length > 0 ? (
        <p className="text-sm text-muted-foreground">{t("group.sometimesNote")}</p>
      ) : null}
      <Button
        size="lg"
        className="self-start"
        onClick={() => void s.proceed()}
        ref={focusOnMount}
        data-testid="continue"
      >
        {t("feedback.continue")}
      </Button>
    </div>
  );
}

function mapState(
  view: Exclude<SessionView, { kind: "done" }>,
  learner: Learner,
  locale: "en" | "nb",
  ctx: StudyContext | null,
  picked: ReadonlySet<string>,
): { focus: MapFocus; highlight: MapHighlight; animate: boolean; padding?: number } {
  const q0 = view.question;
  if (q0.groupId) return groupMapState(view, learner, ctx, picked);
  if (q0.featureId) return featureMapState(view, learner, ctx);
  if (q0.historyId) return historyMapState(view, learner);
  const id = q0.countryId;
  const country = learner.world.byId.get(id);
  const neighbors = country?.neighbors.slice(0, 6) ?? [];
  const city = learner.world.cityById.get(q0.entityId);
  const landmark = learner.world.landmarkById.get(q0.entityId);
  if (view.kind === "intro") {
    return {
      focus: { kind: "countries", ids: [id, ...neighbors] },
      highlight: { target: id, labels: [id, ...neighbors] },
      animate: true,
    };
  }
  if (view.kind === "prompt") {
    const q = view.question;
    if (q.prompt.kind === "map") {
      const v = q.prompt.view;
      return {
        focus: v,
        highlight: { selected: id },
        animate: true,
      };
    }
    if (q.answer.kind === "pin") {
      const v = q.answer.view;
      return {
        focus: v,
        highlight: {},
        animate: true,
      };
    }
    if (q.answer.kind === "map") {
      const v = q.answer.view;
      return {
        focus: v,
        highlight: {},
        animate: true,
      };
    }
    return { focus: { kind: "world" }, highlight: {}, animate: true };
  }
  // Landmark cards: the landmark on the map, and the learner's pin with the line to it.
  if (landmark && country) {
    const pinned = view.outcome.pinned;
    return {
      focus: { kind: "countries", ids: [id] },
      highlight: {
        target: id,
        points: [
          {
            at: [landmark.lon, landmark.lat] as [number, number],
            kind: "target" as const,
            label: landmark.names[locale],
          },
          ...(pinned ? [{ at: pinned, kind: "pin" as const }] : []),
        ],
      },
      animate: true,
      padding: 0.3,
    };
  }
  // City cards: the city on the map; a pin answer adds the pin and the line between them. A
  // not-the-capital card shows the capital and the city it is mistaken for.
  if (city && country) {
    const capital = country.capitals.find((c) => c.roles.includes("primary"));
    const pinned = view.outcome.pinned;
    const points =
      q0.type === "contrast"
        ? [
            ...(capital
              ? [
                  {
                    at: [capital.lon, capital.lat] as [number, number],
                    kind: "target" as const,
                    label: capital.names[locale],
                  },
                ]
              : []),
            {
              at: [city.lon, city.lat] as [number, number],
              kind: "pin" as const,
              label: city.names[locale],
            },
          ]
        : [
            {
              at: [city.lon, city.lat] as [number, number],
              kind: "target" as const,
              label: city.names[locale],
            },
            ...(pinned ? [{ at: pinned, kind: "pin" as const }] : []),
          ];
    return {
      focus: { kind: "countries", ids: [id] },
      highlight: { points },
      animate: true,
      padding: 0.3,
    };
  }
  const chosen =
    !view.outcome.correct && view.outcome.chosenId && learner.world.byId.has(view.outcome.chosenId)
      ? view.outcome.chosenId
      : null;
  return {
    focus: { kind: "countries", ids: [id, ...(chosen ? [chosen] : [])] },
    highlight: { target: id, chosen, labels: [id, ...neighbors] },
    animate: true,
    padding: chosen ? 0.12 : 0.32,
  };
}

/** Group cards: the members on the map, the learner's taps, and wrong picks dashed. */
function groupMapState(
  view: Exclude<SessionView, { kind: "done" }>,
  learner: Learner,
  ctx: StudyContext | null,
  picked: ReadonlySet<string>,
): { focus: MapFocus; highlight: MapHighlight; animate: boolean; padding?: number } {
  const q = view.question;
  const toFocus = (v: MapView): MapFocus => v;
  if (view.kind !== "feedback") {
    if (q.prompt.kind === "groupMap")
      return {
        focus: toFocus(q.prompt.view),
        highlight: { selected: q.prompt.ids },
        animate: true,
      };
    if (q.answer.kind === "taps")
      return { focus: toFocus(q.answer.view), highlight: { selected: [...picked] }, animate: true };
    return { focus: { kind: "world" }, highlight: {}, animate: true };
  }
  const { members, sometimes } = groupMembers(q, ctx);
  const o = view.outcome;
  const chosenGroup = o.chosenId ? learner.world.groupById.get(o.chosenId) : undefined;
  const wrong = o.correct
    ? (o.taps?.wrong ?? [])
    : (o.taps?.wrong ??
      (chosenGroup
        ? chosenGroup.members.filter((id) => !members.includes(id) && learner.world.byId.has(id))
        : o.chosenId && learner.world.byId.has(o.chosenId)
          ? [o.chosenId]
          : []));
  return {
    focus: { kind: "countries", ids: [...members, ...wrong] },
    highlight: {
      target: members,
      chosen: wrong,
      tinted: new Set(sometimes),
      labels: members.length <= 8 ? members : [],
    },
    animate: true,
    padding: 0.12,
  };
}

/**
 * History outlines to draw: the one asked about while it is the prompt, and at feedback the
 * answer plus the learner's wrong pick. Never on a prompt where it would give the answer away.
 */
function historyOutlines(
  view: Exclude<SessionView, { kind: "done" }>,
  learner: Learner,
): HistoricalEntity[] | undefined {
  const q = view.question;
  const entity = q.historyId ? learner.world.historyById.get(q.historyId) : undefined;
  if (!entity || entity.kind === "former_name") return undefined;
  if (view.kind !== "feedback") return q.prompt.kind === "historyMap" ? [entity] : undefined;
  const o = view.outcome;
  const wrong =
    !o.correct && o.chosenId && q.answerKind === "history"
      ? learner.world.historyById.get(o.chosenId)
      : undefined;
  return wrong && wrong.kind !== "former_name" ? [entity, wrong] : [entity];
}

/** History cards: the outline asked about, then the answer: the outline or today's country. */
function historyMapState(
  view: Exclude<SessionView, { kind: "done" }>,
  learner: Learner,
): { focus: MapFocus; highlight: MapHighlight; animate: boolean; padding?: number } {
  const q = view.question;
  const entity = q.historyId ? learner.world.historyById.get(q.historyId) : undefined;
  if (!entity) return { focus: { kind: "world" }, highlight: {}, animate: true };
  if (view.kind !== "feedback") {
    if (q.prompt.kind === "historyMap")
      return { focus: q.prompt.view, highlight: { selected: entity.id }, animate: true };
    return { focus: { kind: "world" }, highlight: {}, animate: true };
  }
  const o = view.outcome;
  const wrongCountry =
    !o.correct && o.chosenId && learner.world.byId.has(o.chosenId) ? o.chosenId : null;
  if (entity.kind === "former_name") {
    const id = entity.currentCountry;
    const near = learner.world.byId.get(id)?.neighbors.slice(0, 6) ?? [];
    return {
      focus: { kind: "countries", ids: [id, ...near, ...(wrongCountry ? [wrongCountry] : [])] },
      highlight: { target: id, chosen: wrongCountry, labels: [id, ...near] },
      animate: true,
    };
  }
  const wrongOutline = !o.correct && o.chosenId && q.answerKind === "history" ? o.chosenId : null;
  return {
    focus: outlineView(entity),
    highlight: {
      target: entity.id,
      chosen: wrongOutline ?? wrongCountry,
      labels: [entity.id, ...(wrongOutline ? [wrongOutline] : [])],
    },
    animate: true,
    padding: 0.12,
  };
}

/** Physical cards: the feature highlighted or tappable, then the answer with the wrong pick. */
function featureMapState(
  view: Exclude<SessionView, { kind: "done" }>,
  learner: Learner,
  ctx: StudyContext | null,
): { focus: MapFocus; highlight: MapHighlight; animate: boolean; padding?: number } {
  const q = view.question;
  const id = q.featureId ?? "";
  const toFocus = (v: MapView): MapFocus => v;
  if (view.kind !== "feedback") {
    if (q.prompt.kind === "featureMap")
      return { focus: toFocus(q.prompt.view), highlight: { selected: id }, animate: true };
    if (q.answer.kind === "feature")
      return { focus: toFocus(q.answer.view), highlight: {}, animate: true };
    return { focus: { kind: "world" }, highlight: {}, animate: true };
  }
  const o = view.outcome;
  const wrong =
    !o.correct && o.chosenId && learner.world.physicalById.has(o.chosenId) ? o.chosenId : null;
  const focus = ctx ? toFocus(featureView(ctx, id, "new")) : ({ kind: "world" } as MapFocus);
  return {
    focus,
    highlight: { target: id, chosen: wrong, labels: [id, ...(wrong ? [wrong] : [])] },
    animate: true,
    padding: 0.12,
  };
}
