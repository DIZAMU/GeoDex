/**
 * A short note in the middle of Today about the streak's freezes, shown once each: when a
 * missed day used a freeze, and when the first freeze is earned.
 */
import { SnowflakeIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/db/db";
import { setFreezeNoticesSeen } from "@/db/settings";
import { freezeNotice, type Streak } from "@/engine/streak";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog";
import type { Learner } from "../study/useLearner";

export function FreezeNotice({
  learner,
  streak,
  blocked,
}: {
  learner: Learner;
  streak: Streak;
  /** Another dialog is open; this one waits for the next visit. */
  blocked: boolean;
}) {
  const { t } = useTranslation();
  // Decided once per visit to Today, so it does not change under the learner.
  const [notice] = useState(() =>
    freezeNotice(
      streak,
      {
        usedThrough: learner.device.freezeUsedNoticeThrough ?? null,
        firstSeen: learner.device.firstFreezeSeen === true,
      },
      Date.now(),
    ),
  );
  const [open, setOpen] = useState(true);
  if (!notice || blocked) return null;

  // Remember the notice before it closes, so leaving right away cannot bring it back.
  const close = () => {
    void setFreezeNoticesSeen(
      db,
      notice.kind === "used"
        ? { freezeUsedNoticeThrough: notice.through, firstFreezeSeen: true }
        : { firstFreezeSeen: true },
    ).finally(() => setOpen(false));
  };
  const next = notice.nextIn === null ? null : t("streak.freeze.next", { count: notice.nextIn });
  const body =
    notice.kind === "used"
      ? [
          t("streak.freeze.usedBody", { count: notice.days }),
          notice.left > 0
            ? t("streak.freeze.left", { count: notice.left })
            : t("streak.freeze.leftNone"),
          next,
        ]
      : [t("streak.freeze.firstBody"), next];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent
        showCloseButton={false}
        className="gap-4 p-6 text-center"
        data-testid="freeze-notice"
        data-kind={notice.kind}
      >
        <DialogHeader className="items-center gap-3 text-center sm:text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SnowflakeIcon aria-hidden className="size-6" />
          </span>
          <DialogTitle className="text-xl tracking-tight">
            {notice.kind === "used" ? t("streak.freeze.usedTitle") : t("streak.freeze.firstTitle")}
          </DialogTitle>
          <DialogDescription className="text-base">
            {body.filter(Boolean).join(" ")}
          </DialogDescription>
        </DialogHeader>
        <Button onClick={close} data-testid="freeze-ok" autoFocus>
          {t("streak.freeze.ok")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
