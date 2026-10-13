import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportData, importData, parseBackup } from "@/db/backup";
import { db } from "@/db/db";
import { Button } from "@/ui/button";
import type { Learner } from "../study/useLearner";

/** JSON export and import of all local data (PLAN.md 5.6). */
export function BackupSection({ learner }: { learner: Learner }) {
  const { t } = useTranslation();
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
