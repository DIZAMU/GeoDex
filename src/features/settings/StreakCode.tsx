import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/db/db";
import { updateSettings } from "@/db/settings";
import { isStreakCode, MAX_RESTORED_STREAK } from "@/engine/redeem";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { useProgress } from "../study/progress";
import type { Learner } from "../study/useLearner";

/** A code that, once accepted, lets the streak be set to a number of days. */
export function StreakCode({ learner }: { learner: Learner }) {
  const { t } = useTranslation();
  const { streak } = useProgress(learner);
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [days, setDays] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const codeId = useId();
  const daysId = useId();

  const redeem = async (event: FormEvent) => {
    event.preventDefault();
    if (await isStreakCode(code)) {
      setUnlocked(true);
      setDays(String(streak.current));
      setMessage(null);
    } else {
      setMessage(t("streakCode.invalid"));
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const n = Number(days);
    if (!Number.isInteger(n) || n < 0 || n > MAX_RESTORED_STREAK) {
      setMessage(t("streakCode.badDays", { max: MAX_RESTORED_STREAK }));
      return;
    }
    await updateSettings(db, { streakRestore: { day: Date.now(), days: n } });
    setUnlocked(false);
    setCode("");
    setMessage(t("streakCode.done", { count: n }));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">{t("streakCode.body")}</p>
      {unlocked ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void save(e)}>
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor={daysId}>{t("streakCode.days")}</label>
            <Input
              id={daysId}
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_RESTORED_STREAK}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-32"
              data-testid="streak-days"
            />
          </div>
          <Button type="submit" data-testid="streak-save">
            {t("streakCode.save")}
          </Button>
        </form>
      ) : (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void redeem(e)}>
          <div className="flex w-80 max-w-full min-w-0 flex-col gap-1 text-sm">
            <label htmlFor={codeId}>{t("streakCode.label")}</label>
            <Input
              id={codeId}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              data-testid="streak-code"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={!code.trim()}
            data-testid="streak-redeem"
          >
            {t("streakCode.redeem")}
          </Button>
        </form>
      )}
      {message ? (
        <p className="text-sm" role="status" data-testid="streak-code-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
