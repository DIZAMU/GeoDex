import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";

const ROWS = [
  ["1-6", "shortcuts.choose"],
  ["Enter", "shortcuts.submit"],
  ["Enter, Space", "shortcuts.continue"],
  ["H", "shortcuts.hint"],
  ["N", "shortcuts.notHelpful"],
  ["Esc", "shortcuts.end"],
  ["?", "shortcuts.help"],
] as const;

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          {ROWS.map(([keys, label]) => (
            <div key={label} className="contents">
              <dt>
                <kbd className="rounded border border-border px-1.5 py-0.5 text-sm">{keys}</kbd>
              </dt>
              <dd>{t(label)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
