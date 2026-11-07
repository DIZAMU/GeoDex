/**
 * More after "Done for today": a few new cards past the day's allowance, a drill, or a higher
 * daily limit. The card sits on Today; the dialog opens once, right after the session that
 * finished the day.
 */
import { DumbbellIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { db } from "@/db/db";
import { updateSettings } from "@/db/settings";
import { MAX_NEW_PER_DAY } from "@/engine/budget";
import { KEEP_GOING } from "@/engine/focus";
import { parseCardId } from "@/engine/types";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog";
import type { Learner } from "../study/useLearner";

/** The default daily limit of new cards (no override: they also fit the daily time). */
export const DEFAULT_NEW_LIMIT = MAX_NEW_PER_DAY;

/** The next limit up, or null at the top. */
export function nextLimit(override: number | null): 50 | 100 | null {
  if (override === null || override < 50) return 50;
  if (override < 100) return 100;
  return null;
}

/** Where the actions lead: a keep-going session, and a drill on the region studied last. */
function useActions(learner: Learner) {
  const navigate = useNavigate();
  let last: Learner["events"][number] | undefined;
  for (const e of learner.events) if (!last || e.reviewedAt > last.reviewedAt) last = e;
  // A contrast card's entity is a pair ("NOR|SWE"); its first country stands for it.
  const lastEntity = last ? parseCardId(last.cardId).entityId.split("|")[0] : undefined;
  const home = learner.settings.homeCountry ?? undefined;
  const subregion =
    (lastEntity && learner.world.byId.get(lastEntity)?.subregion) ||
    (home && learner.world.byId.get(home)?.subregion) ||
    null;
  return {
    keepGoing: () => {
      const params = new URLSearchParams({
        input: learner.device.lastInputMode,
        more: String(KEEP_GOING),
      });
      navigate(`/session?${params}`, { viewTransition: true });
    },
    drill: () =>
      navigate(subregion ? `/drill?region=${subregion}` : "/atlas", { viewTransition: true }),
  };
}

/** The actions under "Done for today". */
export function KeepGoingCard({ learner }: { learner: Learner }) {
  const { t } = useTranslation();
  const { keepGoing, drill } = useActions(learner);
  return (
    <div className="flex flex-col gap-3 pt-2" data-testid="keep-going-card">
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={keepGoing} data-testid="keep-going">
          <PlusIcon aria-hidden />
          {t("today.keepGoing", { count: KEEP_GOING })}
        </Button>
        <Button size="lg" variant="outline" onClick={drill} data-testid="done-drill">
          <DumbbellIcon aria-hidden />
          {t("today.drill")}
        </Button>
      </div>
      <p className="max-w-[60ch] text-sm text-muted-foreground">{t("today.moreNote")}</p>
    </div>
  );
}

/**
 * The dialog's other choices: a faint fill of the text colour and a clearer edge, so they read
 * as buttons on the dialog's surface rather than as holes in it, and a stronger fill on hover.
 */
const ON_DIALOG = "border-foreground/15 bg-foreground/5 hover:bg-foreground/12";

/** "Good job!": shown once the session that finished the day ends. */
export function DoneDialog({
  learner,
  open,
  onOpenChange,
}: {
  learner: Learner;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { keepGoing, drill } = useActions(learner);
  const raiseTo = nextLimit(learner.settings.newPerDayOverride);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} data-testid="done-dialog" className="gap-5 p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl tracking-tight">
            {t("today.doneDialog.title")}
          </DialogTitle>
          <DialogDescription className="text-base">{t("today.doneDialog.body")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={keepGoing} data-testid="dialog-keep-going">
            <PlusIcon aria-hidden />
            {t("today.keepGoing", { count: KEEP_GOING })}
          </Button>
          {raiseTo !== null ? (
            <Button
              size="lg"
              variant="outline"
              className={ON_DIALOG}
              data-testid="dialog-raise"
              onClick={async () => {
                // More new cards from now on; Today fills with them as soon as this is saved.
                await updateSettings(db, { newPerDayOverride: raiseTo });
                onOpenChange(false);
              }}
            >
              {t("today.doneDialog.raise", { count: raiseTo })}
            </Button>
          ) : null}
          <Button
            size="lg"
            variant="outline"
            className={ON_DIALOG}
            onClick={drill}
            data-testid="dialog-drill"
          >
            <DumbbellIcon aria-hidden />
            {t("today.drill")}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="dialog-not-now"
          >
            {t("today.doneDialog.notNow")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
