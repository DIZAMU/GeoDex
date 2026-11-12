import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportData, importData, parseBackup } from "@/db/backup";
import { db } from "@/db/db";
import { setLastBackup } from "@/db/settings";
import { Button } from "@/ui/button";
import type { Learner } from "../study/useLearner";

/** Backup files: the only way progress moves between browsers. */
export function BackupSection({ learner }: { learner: Learner }) {
  const { t, i18n } = useTranslation();
  const last = learner.device.lastBackupAt;
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const download = async () => {
    const backup = await exportData(db);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `geodex-backup-${new Date(backup.exportedAt).toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    await setLastBackup(db, backup.exportedAt);
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    try {
      const result = await importData(db, parseBackup(await chosen.text()), learner.scheduler);
      setMessage(t("backup.imported", result));
    } catch {
      setMessage(t("backup.importError"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">{t("backup.body")}</p>
      <p className="text-sm text-muted-foreground" data-testid="last-backup">
        {last
          ? t("backup.lastBackup", {
              date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(last),
            })
          : t("backup.never")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void download()} data-testid="export">
          {t("backup.export")}
        </Button>
        <Button variant="outline" onClick={() => file.current?.click()}>
          {t("backup.import")}
        </Button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void upload(e)}
          data-testid="import-file"
        />
      </div>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
