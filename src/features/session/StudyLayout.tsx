import type { ReactNode } from "react";

/**
 * Session layout (PLAN.md 8.3): desktop has the map on the left two thirds and the panel
 * on the right; phone has the map in the top 55% and the panel below.
 */
export function StudyLayout({
  top,
  map,
  panel,
}: {
  top: ReactNode;
  map: ReactNode;
  panel: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col">
      <div className="border-b border-border">{top}</div>
      <div className="grid min-h-0 flex-1 grid-rows-[55%_1fr] lg:grid-cols-[2fr_1fr] lg:grid-rows-1">
        <section className="min-h-0 border-b border-border lg:border-r lg:border-b-0">
          {map}
        </section>
        <section className="min-h-0 overflow-y-auto bg-card p-4 text-card-foreground lg:p-8">
          {panel}
        </section>
      </div>
    </div>
  );
}

export function ProgressBar({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label: string;
}) {
  const share = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="flex items-center gap-4 px-4 py-2">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={label}
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground tabular-nums" data-testid="left">
        {label}
      </span>
    </div>
  );
}
