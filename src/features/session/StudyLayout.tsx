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
      <div className="relative z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        {top}
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[55%_1fr] lg:grid-cols-[2fr_1fr] lg:grid-rows-1">
        <section className="min-h-0">{map}</section>
        <section className="relative min-h-0 overflow-y-auto border-t border-border bg-card/95 p-4 text-card-foreground shadow-[var(--elevation)] lg:border-t-0 lg:border-l lg:p-8">
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
    <div className="flex items-center gap-4 px-4 py-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={label}
      >
        <div
          className="h-full origin-left rounded-full bg-primary shadow-[0_0_12px_var(--primary)] transition-[width] duration-500 ease-(--ease-ui)"
          style={{ width: `${Math.max(share * 100, done > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="text-sm text-muted-foreground tabular-nums" data-testid="left">
        {label}
      </span>
    </div>
  );
}

/** Countdown ring (PLAN.md 8.3). The number carries the meaning; the ring only shows it. */
export function CountdownRing({
  left,
  total,
  label,
}: {
  left: number;
  total: number;
  label: string;
}) {
  const r = 15;
  const circumference = 2 * Math.PI * r;
  const share = total > 0 ? left / total : 0;
  return (
    <span
      className="relative flex size-11 items-center justify-center"
      role="timer"
      aria-live="polite"
      aria-label={label}
      data-testid="countdown"
    >
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
        />
      </svg>
      <span className="text-sm font-name tabular-nums" aria-hidden>
        {left}
      </span>
    </span>
  );
}
