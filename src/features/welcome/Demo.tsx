/**
 * Three sample questions on the welcome page (PLAN.md 11.1): a map tap, a flag and a
 * capital, with real feedback and a memory hook. Nothing is saved.
 */
import { RotateCcwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Locale } from "@/i18n/locales";
import { WorldMap } from "@/map/WorldMap";
import { Button } from "@/ui/button";
import { ChoiceAnswer, CountryCard, nameOf, PromptText, StatusLine } from "../session/parts";
import { useStudyContext } from "../study/context";
import { buildQuestion, checkChoice, type Question } from "../study/questions";
import type { Learner } from "../study/useLearner";

const CARDS = ["ITA:name_to_map", "JPN:flag_to_name", "AUS:country_to_capital"] as const;
const NO_SCORES = new Map<string, number>();

export function Demo({ learner, locale }: { learner: Learner; locale: Locale }) {
  const { t } = useTranslation();
  const ctx = useStudyContext(learner.world, locale, NO_SCORES, learner.content);
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<{ id: string; correct: boolean } | null>(null);
  const done = step >= CARDS.length;
  const question: Question | null = useMemo(
    () =>
      ctx && !done
        ? buildQuestion(ctx, CARDS[step] as string, undefined, "mc", `welcome-${round}`)
        : null,
    [ctx, step, round, done],
  );
  const countries = learner.world.countries;
  const labelFor = (id: string) => nameOf(learner.world, id, locale);

  const answer = (id: string) => {
    if (!question || picked) return;
    setPicked({ id, correct: checkChoice(question, id).correct });
  };
  const next = () => {
    setPicked(null);
    setStep((s) => s + 1);
  };
  const again = () => {
    setPicked(null);
    setStep(0);
    setRound((r) => r + 1);
  };

  const target = question?.countryId ?? "";
  const country = learner.world.byId.get(target);
  const hook = learner.content?.byEntity.get(target)?.hooks[locale]?.[0]?.text;
  const view = question?.answer.kind === "map" ? question.answer.view : null;
  const selectable =
    question?.answer.kind === "map" && !picked && view?.kind === "countries"
      ? new Set(view.ids)
      : undefined;
  const focus = picked || !view ? { kind: "countries" as const, ids: [target] } : view;

  return (
    <div
      className="surface grid overflow-hidden lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      data-testid="welcome-demo"
    >
      <div className="relative aspect-[16/10] border-b border-border lg:aspect-auto lg:min-h-[26rem] lg:border-r lg:border-b-0">
        <WorldMap
          countries={countries}
          topology={learner.world.topology}
          focus={done ? { kind: "world" } : focus}
          highlight={
            picked
              ? {
                  target,
                  chosen: !picked.correct && learner.world.byId.has(picked.id) ? picked.id : null,
                  labels: [target],
                }
              : question?.prompt.kind === "map"
                ? { selected: target }
                : {}
          }
          selectable={selectable}
          onSelect={answer}
          labelFor={labelFor}
          ariaLabel={t("map.label")}
          animate
          padding={picked ? 0.35 : 0.12}
          interactive={false}
        />
      </div>
      <div className="flex min-h-[22rem] flex-col gap-4 p-5 md:p-7" aria-live="polite">
        {done ? (
          <div className="flex flex-1 flex-col justify-center gap-5" data-testid="demo-done">
            <p className="text-xl font-medium leading-snug">{t("welcome.demoDone")}</p>
            <Button variant="outline" className="self-start" onClick={again}>
              <RotateCcwIcon aria-hidden />
              {t("welcome.demoAgain")}
            </Button>
          </div>
        ) : question ? (
          <>
            <p className="text-sm text-muted-foreground tabular-nums">
              {t("welcome.demoProgress", { n: step + 1, total: CARDS.length })}
            </p>
            <PromptText question={question} world={learner.world} locale={locale} />
            {picked ? (
              <div className="enter flex flex-col gap-4" data-testid="demo-feedback">
                <StatusLine correct={picked.correct} />
                {country ? <CountryCard country={country} locale={locale} /> : null}
                {hook ? (
                  <figure className="flex flex-col gap-1 rounded-lg bg-background p-4">
                    <figcaption className="text-sm text-muted-foreground">
                      {t("feedback.hookLabel")}
                    </figcaption>
                    <blockquote className="text-lg leading-snug" lang={locale}>
                      {hook}
                    </blockquote>
                  </figure>
                ) : null}
                <Button
                  variant="secondary"
                  className="self-start"
                  onClick={next}
                  data-testid="demo-next"
                >
                  {t("welcome.demoNext")}
                </Button>
              </div>
            ) : question.answer.kind === "choice" ? (
              <ChoiceAnswer options={question.answer.options} onPick={answer} />
            ) : (
              <p className="text-muted-foreground">{t("answer.mapHelp")}</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
