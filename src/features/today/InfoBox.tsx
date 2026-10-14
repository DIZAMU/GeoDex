/**
 * "What is GeoDex?" on Today (PLAN.md 11.1): open by default in the learner's first week,
 * then a single line that opens on tap. The learner's choice is remembered on this device.
 */
import { BrainIcon, ChevronDownIcon, MapIcon, SparklesIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { db } from "@/db/db";
import { setInfoboxOpen } from "@/db/settings";
import type { Learner } from "../study/useLearner";

const WEEK_MS = 7 * 86_400_000;

/** Open by default until a week after the first review. */
export function infoboxOpenByDefault(
  events: readonly { reviewedAt: number }[],
  now: number,
): boolean {
  if (events.length === 0) return true;
  const first = Math.min(...events.map((e) => e.reviewedAt));
  return now - first < WEEK_MS;
}

export function InfoBox({ learner }: { learner: Learner }) {
  const { t } = useTranslation();
  const open = learner.device.infoboxOpen ?? infoboxOpenByDefault(learner.events, Date.now());
  const points = [
    { id: "what", icon: SparklesIcon },
    { id: "when", icon: BrainIcon },
    { id: "progress", icon: MapIcon },
  ] as const;
  return (
    <section
      className="surface overflow-hidden"
      aria-labelledby="infobox-title"
      data-testid="infobox"
      data-open={open}
    >
      <h2 id="infobox-title">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-name text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={open}
          onClick={() => void setInfoboxOpen(db, !open)}
          data-testid="infobox-toggle"
        >
          {t("infobox.title")}
          <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
            {open ? t("infobox.close") : t("infobox.open")}
            <ChevronDownIcon
              aria-hidden
              className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </h2>
      {open ? (
        <div className="enter flex flex-col gap-3 border-t border-border px-4 pt-3 pb-4">
          <ul className="flex flex-col gap-2.5">
            {points.map(({ id, icon: Icon }) => (
              <li key={id} className="flex items-start gap-3">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-sm">{t(`infobox.points.${id}`)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link
              to="/help"
              viewTransition
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("infobox.help")}
            </Link>
            <Link
              to="/welcome"
              viewTransition
              className="text-primary underline-offset-4 hover:underline"
            >
              {t("infobox.welcome")}
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
