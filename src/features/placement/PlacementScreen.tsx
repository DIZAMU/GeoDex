import { MapPinIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { db, type ReviewEvent } from "@/db/db";
import { recordReview } from "@/db/reviews";
import { updateSettings } from "@/db/settings";
import {
  answerPlacement,
  currentQuestion,
  type PlacementState,
  placementReview,
  skipSubregion,
  startPlacement,
} from "@/engine/placement";
import { subregionOrder } from "@/engine/session";
import { isLocale } from "@/i18n/locales";
import { type MapFocus, type MapHighlight, WorldMap } from "@/map/WorldMap";
import { Button } from "@/ui/button";
import { Stat } from "@/ui/stat";
import {
  ChoiceAnswer,
  CountryCard,
  FlagAnswer,
  nameOf,
  PromptText,
  StatusLine,
  useSessionKeys,
} from "../session/parts";
import { ShortcutsDialog } from "../session/ShortcutsDialog";
import { ProgressBar, StudyLayout } from "../session/StudyLayout";
import { useStudyContext } from "../study/context";
import { planDay, scopedCountries } from "../study/plan";
import { buildQuestion, checkChoice, type Question } from "../study/questions";
import { type Learner, useLearner } from "../study/useLearner";

export function PlacementScreen() {
  const learner = useLearner();
  const { t } = useTranslation();
  if (!learner) return <p className="p-8 text-muted-foreground">{t("common.loading")}</p>;
  return <Placement learner={learner} />;
}

type Tally = { countries: Set<string>; capitals: number; flags: number };
type Feedback = { question: Question; correct: boolean; chosenId: string };

function Placement({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const ctx = useStudyContext(
    learner.world,
    locale,
    useMemo(() => new Map(), []),
  );
  const countries = useMemo(
    () => scopedCountries(learner.world, learner.settings),
    [learner.world, learner.settings],
  );
  const [state, setState] = useState<PlacementState | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [finished, setFinished] = useState(false);
  const [help, setHelp] = useState(false);
  const tally = useRef<Tally>({ countries: new Set(), capitals: 0, flags: 0 });
  const shownAt = useRef(performance.now());

  // Resume saved progress, or start from the home region outward.
  useEffect(() => {
    void (async () => {
      const saved = await db.placementProgress.get("current");
      if (saved?.state) {
        setState(saved.state as PlacementState);
        return;
      }
      const members: Record<string, string[]> = {};
      for (const c of countries) {
        members[c.subregion] = [...(members[c.subregion] ?? []), c.id];
      }
      setState(
        startPlacement({
          order: subregionOrder(learner.settings.homeCountry ?? "", countries),
          members,
          startedAt: Date.now(),
          seed: learner.device.deviceId,
        }),
      );
    })();
  }, [countries, learner.settings.homeCountry, learner.device.deviceId]);

  const save = useCallback(async (next: PlacementState) => {
    setState(next);
    if (next.done) {
      await updateSettings(db, { placementCompletedAt: Date.now() });
      await db.placementProgress.delete("current");
      setFinished(true);
    } else {
      await db.placementProgress.put({ id: "current", state: next, updatedAt: Date.now() });
    }
  }, []);

  const asked = state ? currentQuestion(state) : null;
  const question = useMemo(
    () =>
      asked && ctx
        ? buildQuestion(ctx, asked.cardId, undefined, "mc", `placement:${asked.cardId}`)
        : null,
    [asked, ctx],
  );

  useEffect(() => {
    if (question) shownAt.current = performance.now();
  }, [question]);

  const answer = useCallback(
    async (id: string) => {
      if (!question || !asked || feedback) return;
      const correct = checkChoice(question, id).correct;
      const responseMs = Math.round(performance.now() - shownAt.current);
      const review = placementReview(correct);
      const event: ReviewEvent = {
        id: crypto.randomUUID(),
        cardId: question.cardId,
        reviewedAt: Date.now(),
        rating: review.rating,
        mode: review.mode,
        inputSetting: "mc",
        correct,
        chosenAnswer: correct ? null : id,
        responseMs,
        durationMs: responseMs,
        snippetIds: [],
        scheduled: review.scheduled,
        locale,
        deviceId: learner.device.deviceId,
        synced: 0,
      };
      await recordReview(db, learner.scheduler, event);
      if (correct) {
        if (asked.kind === "capital") tally.current.capitals++;
        else if (asked.kind === "flag") tally.current.flags++;
        else tally.current.countries.add(asked.entityId);
      }
      setFeedback({ question, correct, chosenId: id });
    },
    [question, asked, feedback, locale, learner.device.deviceId, learner.scheduler],
  );

  const proceed = useCallback(async () => {
    if (!state || !feedback) return;
    const next = answerPlacement(state, feedback.correct, Date.now());
    setFeedback(null);
    await save(next);
  }, [state, feedback, save]);

  const skip = useCallback(async () => {
    if (state && !feedback) await save(skipSubregion(state));
  }, [state, feedback, save]);

  const finishNow = useCallback(async () => {
    if (state) await save({ ...state, queue: [], done: true });
  }, [state, save]);

  const options =
    question && (question.answer.kind === "choice" || question.answer.kind === "flags")
      ? question.answer.options
      : [];
  useSessionKeys({
    choose: (index) => {
      const option = options[index];
      if (option) void answer(option.id);
    },
    proceed: feedback ? () => void proceed() : undefined,
    end: () => void finishNow(),
    help: () => setHelp(true),
  });

  const labelFor = useCallback(
    (id: string) => nameOf(learner.world, id, locale),
    [learner.world, locale],
  );

  if (finished) return <Result learner={learner} tally={tally.current} locale={locale} />;
  if (!state || !question || !ctx)
    return <p className="p-8 text-muted-foreground">{t("common.loading")}</p>;

  const subregionIds = countries.filter((c) => c.subregion === asked?.subregion).map((c) => c.id);
  const country = learner.world.byId.get(question.entityId);
  const neighbors = country?.neighbors.slice(0, 6) ?? [];
  const chosenId =
    feedback && !feedback.correct && learner.world.byId.has(feedback.chosenId)
      ? feedback.chosenId
      : null;
  const focus: MapFocus = feedback
    ? { kind: "countries", ids: chosenId ? [question.entityId, chosenId] : [question.entityId] }
    : { kind: "countries", ids: subregionIds };
  const highlight: MapHighlight = feedback
    ? {
        target: question.entityId,
        chosen:
          !feedback.correct && learner.world.byId.has(feedback.chosenId) ? feedback.chosenId : null,
        labels: [question.entityId, ...neighbors],
      }
    : question.prompt.kind === "map"
      ? { selected: question.entityId }
      : {};
  const region =
    learner.world.subregions.find((s) => s.id === asked?.subregion)?.names[locale] ?? "";

  return (
    <>
      <StudyLayout
        top={
          <div className="flex items-center gap-2 pr-2">
            <div className="flex-1">
              <ProgressBar
                done={state.asked}
                total={Math.max(state.asked + 1, 120)}
                label={t("placement.answered", { count: state.asked })}
              />
            </div>
            <Button
              variant="ghost"
              onClick={() => void skip()}
              disabled={!!feedback}
              data-testid="skip-region"
            >
              {t("placement.skip")}
            </Button>
            <Button variant="ghost" onClick={() => void finishNow()} data-testid="finish-placement">
              {t("placement.finish")}
            </Button>
          </div>
        }
        map={
          <WorldMap
            countries={countries}
            topology={learner.world.topology}
            focus={focus}
            highlight={highlight}
            labelFor={labelFor}
            ariaLabel={t("map.label")}
            animate
            padding={feedback && !chosenId ? 0.32 : 0.12}
          />
        }
        panel={
          <div
            key={`${question.cardId}:${feedback ? "feedback" : "prompt"}`}
            className="enter flex flex-col gap-3 lg:gap-6"
            data-testid="placement"
          >
            {state.asked === 0 && !feedback ? (
              <p className="text-sm text-muted-foreground lg:text-base">{t("placement.intro")}</p>
            ) : null}
            <p className="hidden items-center gap-2 self-start rounded-full border border-border bg-background/40 px-3 py-1 text-sm text-muted-foreground lg:inline-flex">
              <MapPinIcon aria-hidden className="size-4 text-primary" />
              {t("placement.region", { name: region })}
            </p>
            {feedback && country ? (
              <div className="flex flex-col gap-5" data-testid="feedback">
                <StatusLine correct={feedback.correct} />
                <CountryCard country={country} locale={locale} />
                <Button
                  size="lg"
                  className="self-start"
                  onClick={() => void proceed()}
                  autoFocus
                  data-testid="continue"
                >
                  {t("feedback.continue")}
                </Button>
              </div>
            ) : (
              <>
                <PromptText question={question} world={learner.world} locale={locale} />
                {question.answer.kind === "flags" ? (
                  <FlagAnswer options={question.answer.options} onPick={(id) => void answer(id)} />
                ) : question.answer.kind === "choice" ? (
                  <ChoiceAnswer
                    options={question.answer.options}
                    onPick={(id) => void answer(id)}
                  />
                ) : null}
              </>
            )}
          </div>
        }
      />
      <ShortcutsDialog open={help} onOpenChange={setHelp} />
    </>
  );
}

function Result({
  learner,
  tally,
  locale,
}: {
  learner: Learner;
  tally: Tally;
  locale: "en" | "nb";
}) {
  const { t } = useTranslation();
  const fresh = useLearner();
  const source = fresh ?? learner;
  const plan = useMemo(() => planDay({ ...source, now: Date.now() }), [source]);
  const countries = useMemo(
    () => scopedCountries(source.world, source.settings),
    [source.world, source.settings],
  );
  const region = plan.nextSubregion
    ? source.world.subregions.find((s) => s.id === plan.nextSubregion)?.names[locale]
    : null;
  const number = new Intl.NumberFormat(locale);
  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      <div className="h-[55%] min-h-0 lg:h-auto lg:flex-[2]">
        <WorldMap
          countries={countries}
          topology={source.world.topology}
          focus={{ kind: "world" }}
          highlight={{ filled: tally.countries }}
          labelFor={(id) => nameOf(source.world, id, locale)}
          ariaLabel={t("map.label")}
        />
      </div>
      <section
        className="stagger flex flex-col gap-5 overflow-y-auto border-t border-border bg-card/95 p-6 lg:flex-1 lg:justify-center lg:border-t-0 lg:border-l lg:p-10"
        data-testid="placement-result"
      >
        <h1 className="font-name text-3xl tracking-tight">{t("placement.resultTitle")}</h1>
        <dl className="grid grid-cols-3 gap-3">
          <Stat
            label={t("placement.statCountries")}
            value={number.format(tally.countries.size)}
            className="bg-background/40"
          />
          <Stat
            label={t("placement.statCapitals")}
            value={number.format(tally.capitals)}
            className="bg-background/40"
          />
          <Stat
            label={t("placement.statFlags")}
            value={number.format(tally.flags)}
            className="bg-background/40"
          />
        </dl>
        {region ? (
          <p className="text-muted-foreground">{t("placement.startsWith", { region })}</p>
        ) : null}
        <Button asChild size="lg" className="self-start" data-testid="to-today">
          <Link to="/">{t("placement.toToday")}</Link>
        </Button>
      </section>
    </div>
  );
}
