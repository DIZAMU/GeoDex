import { useLiveQuery } from "dexie-react-hooks";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/db/db";
import { useSync } from "@/sync/SyncProvider";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

/** Sign-in with an email code, sync status and controls (PLAN.md 5.6). */
export function SyncSection() {
  const { t, i18n } = useTranslation();
  const sync = useSync();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const pending = useLiveQuery(
    async () =>
      (await db.reviewEvents.where("synced").equals(0).count()) +
      (await db.hookVoteEvents.where("synced").equals(0).count()),
    [],
  );

  if (sync.status === "off") return <p className="text-muted-foreground">{t("sync.off")}</p>;

  if (sync.status === "signed-out") {
    const send = async (event: FormEvent) => {
      event.preventDefault();
      setProblem(null);
      try {
        await sync.sendCode(email);
        setSentTo(email.trim());
      } catch (e) {
        const message = (e as Error).message;
        setProblem(
          /signups? not allowed/i.test(message)
            ? t("sync.noAccount")
            : t("sync.sendError", { message }),
        );
      }
    };
    const verify = async (event: FormEvent) => {
      event.preventDefault();
      setProblem(null);
      try {
        await sync.verifyCode(sentTo ?? email, code);
      } catch {
        setProblem(t("sync.codeError"));
      }
    };
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">{t("sync.intro")}</p>
        {sentTo === null ? (
          <form onSubmit={send} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="sync-email">
              {t("sync.email")}
            </label>
            <Input
              id="sync-email"
              type="email"
              autoComplete="email"
              required
              placeholder={t("sync.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit">{t("sync.sendCode")}</Button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-3">
            <p>{t("sync.codeSent", { email: sentTo })}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="sync-code">
                {t("sync.code")}
              </label>
              <Input
                id="sync-code"
                autoComplete="one-time-code"
                autoCapitalize="off"
                spellCheck={false}
                required
                placeholder={t("sync.code")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button type="submit">{t("sync.signIn")}</Button>
            </div>
          </form>
        )}
        {problem ? <p role="alert">{problem}</p> : null}
      </div>
    );
  }

  const time = sync.lastSyncedAt
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(
        sync.lastSyncedAt,
      )
    : null;
  return (
    <div className="flex flex-col gap-3" data-testid="sync-status">
      <p>{t("sync.signedIn", { email: sync.email })}</p>
      <p className="text-muted-foreground">
        {time ? t("sync.lastSynced", { time }) : t("sync.never")}
        {pending ? ` · ${t("sync.pending", { count: pending })}` : ""}
      </p>
      {sync.status === "offline" ? <p>{t("sync.offline")}</p> : null}
      {sync.status === "error" ? (
        <p role="alert">{t("sync.error", { message: sync.error ?? "" })}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void sync.syncNow()} disabled={sync.status === "syncing"}>
          {sync.status === "syncing" ? t("sync.syncing") : t("sync.syncNow")}
        </Button>
        <Button variant="ghost" onClick={() => void sync.signOut()}>
          {t("sync.signOut")}
        </Button>
      </div>
    </div>
  );
}
