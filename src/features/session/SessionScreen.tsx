import { XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import type { InputSetting } from "@/engine/types";
import { isLocale } from "@/i18n/locales";
import { type MapFocus, type MapHighlight, WorldMap } from "@/map/WorldMap";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { useStudyContext } from "../study/context";
import { confusionScoresFor, scopedCountries } from "../study/plan";
import { checkChoice, checkTyped, type StudyContext } from "../study/questions";
import { type Learner, useLearner } from "../study/useLearner";
import {
  ChoiceAnswer,
  CountryCard,
  FlagAnswer,
  nameOf,
  PromptText,
  StatusLine,
  TypedAnswer,
  useSessionKeys,
} from "./parts";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { CountdownRing, ProgressBar, StudyLayout } from "./StudyLayout";
import { useCountdown } from "./useCountdown";
import { type SessionView, useDailySession } from "./useDailySession";

const INPUTS: readonly InputSetting[] = ["auto", "mc", "typing"];

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

function Session({ learner, input }: { learner: Learner; input: InputSetting }) {
  const { t, i18n } = useTranslation();
  const locale = isLocale(i18n.language) ? i18n.language : "en";
  const navigate = useNavigate();
  // Confusion scores are fixed for the session, like the queue.
  const [scores] = useState(() => confusionScoresFor(learner.world, learner.events, Date.now()));
  const ctx = useStudyContext(learner.world, locale, scores);
  const s = useDailySession(learner, ctx, input, locale);
  const [help, setHelp] = useState(false);
  const countdownSeconds = learner.settings.countdownSeconds;
  const view = s.view;

  const timeLeft = useCountdown(
    view?.kind === "prompt" ? countdownSeconds : 0,
    view?.kind === "prompt" ? view.question.cardId : null,
    () => s.answer({ correct: false, typo: false, chosenId: null }, { timedOut: true }),
  );

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
          : undefined,
    hint: view?.kind === "prompt" && view.question.answer.kind === "typed" ? s.showHint : undefined,
    end: () => void s.end(),
    help: () => setHelp(true),
  });

  const scoped = useMemo(
    () => scopedCountries(learner.world, learner.settings),
    [learner.world, learner.settings],
  );
  const selectable = useMemo(() => new Set(scoped.map((c) => c.id)), [scoped]);
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
      <main className="flex min-h-dvh items-center justify-center px-4 py-16">
        <div className="surface stagger flex w-full max-w-md flex-col gap-5 p-8">
          <h1 className="font-name text-3xl tracking-tight">{t("session.doneTitle")}</h1>
          <p className="text-lg text-muted-foreground" data-testid="reviewed">
            {t("session.reviewed", { count: view.reviewed })}
          </p>
          <Button asChild size="lg" className="self-start">
            <Link to="/" viewTransition>
              {t("session.backToToday")}
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const { focus, highlight, animate, padding } = mapState(view, learner);
  const mapSelectable =
    view.kind === "prompt" && view.question.answer.kind === "map" ? selectable : undefined;

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
            onSelect={(id) => view.kind === "prompt" && s.answer(checkChoice(view.question, id))}
            labelFor={labelFor}
            ariaLabel={t("map.label")}
            animate={animate}
            padding={padding}
          />
        }
        panel={
          // Each new step rises in; the key restarts the entrance.
          <div key={`${view.kind}:${view.item.cardId}`} className="enter">
            <Panel view={view} ctx={s.ctx} session={s} learner={learner} locale={locale} />
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
}: {
  view: Exclude<SessionView, { kind: "done" }>;
  ctx: StudyContext;
  session: ReturnType<typeof useDailySession>;
  learner: Learner;
  locale: "en" | "nb";
}) {
  const { t } = useTranslation();
  const country = learner.world.byId.get(view.item.entityId);
  if (!country) return null;

  if (view.kind === "intro") {
    return (
      <div className="flex flex-col gap-6" data-testid="intro">
        <p className="text-sm text-muted-foreground">{t("intro.label")}</p>
        <CountryCard country={country} locale={locale} />
        <Button size="lg" className="self-start" onClick={s.startPrompt} autoFocus>
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
        q.answerKind === "capital"
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
            <p className="text-muted-foreground">{t("answer.mapHelp")}</p>
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
  const chosenCountry = !o.correct && o.chosenId ? learner.world.byId.get(o.chosenId) : undefined;
  const chosenLabel =
    chosenCountry?.names[locale] ??
    (o.chosenId
      ? (learner.world.countries.flatMap((c) => c.capitals).find((c) => c.id === o.chosenId)?.names[
          locale
        ] ??
        learner.world.languageNames[o.chosenId]?.[locale] ??
        learner.world.countries.flatMap((c) => c.currencies).find((c) => c.code === o.chosenId)
          ?.names[locale] ??
        null)
      : null);
  return (
    <div className="flex flex-col gap-5" data-testid="feedback">
      <StatusLine correct={o.correct} />
      {o.timedOut ? <p>{t("feedback.timeUp")}</p> : o.gaveUp ? <p>{t("feedback.gaveUp")}</p> : null}
      {!o.correct && chosenLabel ? <p>{t("feedback.youPicked", { name: chosenLabel })}</p> : null}
      {o.correct && o.typo && o.matched ? (
        <p>{t("feedback.spelling", { name: o.matched })}</p>
      ) : null}
      <CountryCard country={country} locale={locale} />
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
      <p className="text-sm text-muted-foreground">{t("feedback.placeholder")}</p>
      <Button
        size="lg"
        className="self-start"
        onClick={() => void s.proceed()}
        autoFocus
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
): { focus: MapFocus; highlight: MapHighlight; animate: boolean; padding?: number } {
  const id = view.item.entityId;
  const country = learner.world.byId.get(id);
  const neighbors = country?.neighbors.slice(0, 6) ?? [];
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
        focus: v.kind === "world" ? { kind: "world" } : { kind: "countries", ids: v.ids },
        highlight: { selected: id },
        animate: true,
      };
    }
    if (q.answer.kind === "map") {
      const v = q.answer.view;
      return {
        focus: v.kind === "world" ? { kind: "world" } : { kind: "countries", ids: v.ids },
        highlight: {},
        animate: true,
      };
    }
    return { focus: { kind: "world" }, highlight: {}, animate: true };
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
