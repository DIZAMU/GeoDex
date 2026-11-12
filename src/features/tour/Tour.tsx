/**
 * The tour: five short steps over the real Today screen. A centred
 * card says what a day looks like, then the spotlight glides to the session length (which can
 * be picked right in the card), the answer mode, and the map with the level. The last card
 * asks "Ready?", says what is set up, and starts the first session.
 *
 * The page behind is inert and does not scroll; focus stays in the card. Escape skips. A step
 * whose element is missing is left out. The end is remembered on this device; Help and
 * Settings can start the tour again.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { db } from "@/db/db";
import { setSessionPick } from "@/db/settings";
import { parseLength, SESSION_LENGTHS } from "@/engine/focus";
import { Button } from "@/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group";
import type { Learner } from "../study/useLearner";

export const TOUR_STEPS = ["intro", "length", "input", "progress", "ready"] as const;
type StepId = (typeof TOUR_STEPS)[number];

/** Steps that explain an element on the page, by its data-tour anchor. */
const ANCHORED: ReadonlySet<StepId> = new Set(["length", "input", "progress"]);

type Box = { x: number; y: number; w: number; h: number };
const PAD = 8;
const GAP = 12;
const EDGE = 16;
const CARD_W = 360;
/** Below this width the card spans the screen. */
const NARROW = 640;
/** Room kept under the header when a target is scrolled into view. */
const TOP = 72;

const anchor = (id: StepId) => document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
/** The real start button: the tour's last step presses it for the learner. */
const startButton = () =>
  document.querySelector<HTMLButtonElement>('[data-tour="start"]:not([disabled])');

export function Tour({
  learner,
  region,
  onDone,
}: {
  learner: Learner;
  /** The region new countries come from next, if any. */
  region: string | null;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const number = new Intl.NumberFormat(i18n.language);
  // Only steps whose element is on the page, looked up once Today has rendered.
  const [steps, setSteps] = useState<StepId[]>([]);
  const [canStart, setCanStart] = useState(false);
  useLayoutEffect(() => {
    setSteps(TOUR_STEPS.filter((id) => !ANCHORED.has(id) || anchor(id) !== null));
    setCanStart(startButton() !== null);
  }, []);
  const [index, setIndex] = useState(0);
  const step: StepId | undefined = steps[index];
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [box, setBox] = useState<Box | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(220);
  const primary = useRef<HTMLButtonElement>(null);

  // The page behind cannot be clicked, focused or scrolled while the tour is open.
  useEffect(() => {
    const root = document.getElementById("root");
    const html = document.documentElement;
    const overflow = html.style.overflow;
    if (root) root.inert = true;
    html.style.overflow = "hidden";
    return () => {
      if (root) root.inert = false;
      html.style.overflow = overflow;
    };
  }, []);

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const el = step && ANCHORED.has(step) ? anchor(step) : null;
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    setBox({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
  }, [step]);

  // Bring the target into view with room for the card under it, then measure it.
  useLayoutEffect(() => {
    const el = step && ANCHORED.has(step) ? anchor(step) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      const group = r.height + PAD * 2 + GAP + cardH;
      const top = Math.max(TOP, (window.innerHeight - group) / 2);
      window.scrollTo({ top: window.scrollY + r.top - PAD - top, behavior: "instant" });
    }
    measure();
  }, [step, measure, cardH]);

  // Each step moves focus to its main button.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on purpose when the step changes
  useEffect(() => {
    primary.current?.focus();
  }, [step]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // The card's height decides whether it fits under the target.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setCardH(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  });

  // Close at once; the stored "done" follows a moment later.
  const [closed, setClosed] = useState(false);
  const finish = useCallback(() => {
    setClosed(true);
    onDone();
  }, [onDone]);
  const go = useCallback(
    (delta: number) => {
      const target = index + delta;
      if (target >= steps.length) finish();
      else if (target >= 0) setIndex(target);
    },
    [index, steps.length, finish],
  );
  const start = () => {
    finish();
    // Press the real start button once the page is interactive again, so the session uses
    // exactly what Today shows.
    requestAnimationFrame(() => startButton()?.click());
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, finish]);

  if (!step || closed) return null;

  // Where the card goes: under the target if it fits, else above, else docked to the bottom.
  const narrow = viewport.w < NARROW;
  const cardW = narrow ? viewport.w - EDGE * 2 : Math.min(CARD_W, viewport.w - EDGE * 2);
  let left = (viewport.w - cardW) / 2;
  let top = (viewport.h - cardH) / 2;
  if (box) {
    if (!narrow) {
      left = Math.min(Math.max(EDGE, box.x + box.w / 2 - cardW / 2), viewport.w - cardW - EDGE);
    }
    if (box.y + box.h + GAP + cardH <= viewport.h - EDGE) top = box.y + box.h + GAP;
    else if (box.y - GAP - cardH >= EDGE) top = box.y - GAP - cardH;
    else top = viewport.h - cardH - EDGE;
  }
  // With no target the spotlight shrinks to the centre and the whole screen dims.
  const spot = box ?? { x: viewport.w / 2, y: viewport.h / 2, w: 0, h: 0 };

  const length = parseLength(learner.device.sessionLength);
  const answers = t(`tour.answers.${learner.device.lastInputMode}`);
  const questions = t("picker.lengthOption", { count: length });
  const first = learner.events.length === 0;

  return createPortal(
    <div className="fixed inset-0 z-50" data-testid="tour" data-step={step}>
      <div
        aria-hidden
        className="tour-spot"
        data-empty={box ? undefined : ""}
        style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }}
      />
      <div
        ref={card}
        key={step}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="tour-card floating absolute flex flex-col gap-3 p-5"
        style={{ left, top, width: cardW }}
      >
        <p className="text-sm text-muted-foreground" data-testid="tour-progress">
          {t("tour.progress", { n: index + 1, total: steps.length })}
        </p>
        <h2 id="tour-title" className="text-xl font-medium text-balance">
          {step === "ready" && !canStart
            ? t("tour.steps.ready.titleNothing")
            : t(`tour.steps.${step}.title`)}
        </h2>
        <p id="tour-body" className="text-muted-foreground">
          {step === "ready"
            ? canStart
              ? region
                ? t("tour.steps.ready.body", { questions, region, answers })
                : t("tour.steps.ready.bodyNoRegion", { questions, answers })
              : t("today.nothingLeft")
            : t(`tour.steps.${step}.body`)}
        </p>

        {step === "length" ? (
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            value={String(length)}
            aria-labelledby="tour-title"
            className="self-start"
            onValueChange={(value) => {
              if (value)
                void setSessionPick(db, {
                  sessionLength: parseLength(value),
                  sessionFocus: learner.device.sessionFocus ?? "mixed",
                });
            }}
          >
            {SESSION_LENGTHS.map((n) => (
              <ToggleGroupItem
                key={n}
                value={String(n)}
                className="min-w-14"
                data-testid={`tour-length-${n}`}
              >
                {number.format(n)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {step === "ready" ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
            {canStart ? (
              <>
                <Button ref={primary} onClick={start} data-testid="tour-start">
                  {t(first ? "tour.startFirst" : "tour.start")}
                </Button>
                <Button variant="link" className="px-0" onClick={finish} data-testid="tour-later">
                  {t("tour.later")}
                </Button>
              </>
            ) : (
              <Button ref={primary} onClick={finish} data-testid="tour-next">
                {t("tour.done")}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={finish}
              data-testid="tour-skip"
            >
              {t("tour.skip")}
            </Button>
            <div className="flex gap-2">
              {index > 0 ? (
                <Button variant="secondary" onClick={() => go(-1)} data-testid="tour-back">
                  {t("tour.back")}
                </Button>
              ) : null}
              <Button ref={primary} onClick={() => go(1)} data-testid="tour-next">
                {t("tour.next")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
