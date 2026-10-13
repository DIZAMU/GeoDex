import { useTranslation } from "react-i18next";
import { cn } from "@/ui/utils";

/**
 * Loading state: a small globe with an accent dot in orbit, in the theme's colors. It fades
 * in after a short delay, so loads that finish quickly show nothing at all.
 */
export function Loader({
  className,
  fullScreen = true,
}: {
  className?: string;
  fullScreen?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={cn(
        "loader flex items-center justify-center",
        fullScreen && "min-h-[60dvh]",
        className,
      )}
    >
      <svg viewBox="0 0 48 48" className="size-12" aria-hidden>
        <circle cx="24" cy="24" r="14" className="fill-card stroke-border" strokeWidth="1.5" />
        <ellipse
          cx="24"
          cy="24"
          rx="6"
          ry="14"
          fill="none"
          className="stroke-border"
          strokeWidth="1"
        />
        <line x1="10" y1="24" x2="38" y2="24" className="stroke-border" strokeWidth="1" />
        <g className="loader-orbit">
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="none"
            className="stroke-primary/25"
            strokeWidth="1.5"
          />
          <circle cx="24" cy="4" r="3" className="fill-primary" />
        </g>
      </svg>
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
