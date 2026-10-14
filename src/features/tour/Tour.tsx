/**
 * Guided tour (PLAN.md 11.1): a spotlight over the real screen, one element at a time, with
 * a short note. Steps whose element is missing are skipped. Esc or "Skip tour" ends it; the
 * end is remembered on this device and Help can start it again.
 */
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/button";

export const TOUR_STEPS = ["start", "input", "map", "atlas", "stats", "settings", "help"] as const;
type StepId = (typeof TOUR_STEPS)[number];

type Box = { x: number; y: number; w: number; h: number };
const PAD = 8;
const CARD_W = 340;

export function Tour({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  // Only steps whose anchor is on the page, looked up once it has rendered.
  const [steps, setSteps] = useState<StepId[]>([]);
  useLayoutEffect(() => {
    setSteps(TOUR_STEPS.filter((id) => document.querySelector(`[data-tour="${id}"]`)));
  }, []);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const next = useRef<HTMLButtonElement>(null);
  const step: StepId | undefined = steps[index];

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const el = step ? document.querySelector<HTMLElement>(`[data-tour="${step}"]`) : null;
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    setBox({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
  }, [step]);

  useLayoutEffect(() => {
    const el = step ? document.querySelector<HTMLElement>(`[data-tour="${step}"]`) : null;
    el?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    measure();
    next.current?.focus();
  }, [step, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

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

  // The note sits below the element when there is room, else above; always on screen.
  const cardW = Math.min(CARD_W, viewport.w - 32);
  const below = !box || box.y + box.h + 220 < viewport.h;
  const left = box
    ? Math.min(Math.max(16, box.x + box.w / 2 - cardW / 2), viewport.w - cardW - 16)
    : (viewport.w - cardW) / 2;
  const top = box ? (below ? box.y + box.h + 12 : undefined) : viewport.h / 3;
  const bottom = box && !below ? viewport.h - box.y + 12 : undefined;
  const last = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50" data-testid="tour" data-step={step}>
      <svg aria-hidden className="absolute inset-0 h-full w-full" onClick={finish}>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {box ? (
              <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={14} fill="black" />
            ) : null}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(0 0 0 / 0.6)" mask="url(#tour-hole)" />
        {box ? (
          <rect
            className="tour-ring"
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx={14}
            fill="none"
          />
        ) : null}
      </svg>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("tour.label")}
        aria-describedby="tour-body"
        className="surface enter absolute flex flex-col gap-3 p-5"
        style={{ left, top, bottom, width: cardW }}
        key={step}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-name text-xl" id="tour-title">
            {t(`tour.steps.${step}.title`)}
          </h2>
          <button
            type="button"
            onClick={finish}
            aria-label={t("tour.skip")}
            className="-m-1 rounded-md p-1 text-muted-foreground hover:text-foreground"
            data-testid="tour-close"
          >
            <XIcon aria-hidden className="size-5" />
          </button>
        </div>
        <p id="tour-body" className="text-muted-foreground">
          {t(`tour.steps.${step}.body`)}
        </p>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-sm text-muted-foreground tabular-nums">
            {t("tour.progress", { n: index + 1, total: steps.length })}
          </span>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button variant="outline" size="sm" onClick={() => go(-1)}>
                <ArrowLeftIcon aria-hidden />
                {t("tour.back")}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={finish} data-testid="tour-skip">
                {t("tour.skip")}
              </Button>
            )}
            <Button size="sm" ref={next} onClick={() => go(1)} data-testid="tour-next">
              {last ? t("tour.done") : t("tour.next")}
              {last ? null : <ArrowRightIcon aria-hidden />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
