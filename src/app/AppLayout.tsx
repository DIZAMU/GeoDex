import {
  BarChart3Icon,
  CalendarCheckIcon,
  CircleHelpIcon,
  type LucideIcon,
  MapIcon,
  SettingsIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { cn } from "@/ui/utils";
import lockup from "../../assets/brand/svg/geodex-lockup.svg";
import lockupOnDark from "../../assets/brand/svg/geodex-lockup-on-dark.svg";

function NavItem({
  to,
  label,
  icon: Icon,
  end = false,
  tour,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Anchor for the guided tour. */
  tour?: string;
}) {
  return (
    <NavLink
      data-tour={tour}
      to={to}
      end={end}
      viewTransition
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-muted-foreground sm:px-4 transition-colors duration-200 hover:bg-muted hover:text-foreground",
          isActive &&
            "bg-card font-name text-foreground shadow-[var(--elevation),inset_0_-2px_0_var(--primary)]",
        )
      }
    >
      <Icon aria-hidden className="size-5 sm:hidden" />
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}

/** Shell for the quiet screens (Today, Atlas, Stats, Settings). Session screens use the full viewport. */
export function AppLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 [view-transition-name:site-header] border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 md:px-10">
          {/* The wordmark is artwork, never live text (assets/brand/BRAND.md). */}
          <Link to="/" viewTransition className="flex h-11 items-center rounded-lg">
            <img src={lockup} alt={t("app.name")} className="brand-on-light h-7 w-auto" />
            <img src={lockupOnDark} alt={t("app.name")} className="brand-on-dark h-7 w-auto" />
          </Link>
          <nav className="flex gap-1">
            <NavItem to="/" end label={t("nav.today")} icon={CalendarCheckIcon} />
            <NavItem to="/atlas" label={t("nav.atlas")} icon={MapIcon} tour="atlas" />
            <NavItem to="/stats" label={t("nav.stats")} icon={BarChart3Icon} tour="stats" />
            <NavItem to="/settings" label={t("nav.settings")} icon={SettingsIcon} tour="settings" />
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      {/* Help is one tap away on every screen (PLAN.md 11.1). */}
      {pathname === "/help" ? null : (
        <Link
          to="/help"
          viewTransition
          aria-label={t("help.button")}
          title={t("help.button")}
          data-testid="help-button"
          data-tour="help"
          className="fixed right-4 bottom-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--elevation-hover)] transition-transform duration-200 ease-(--ease-ui) outline-none hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:scale-100 md:right-6 md:bottom-6"
        >
          <CircleHelpIcon aria-hidden className="size-7" />
        </Link>
      )}
    </div>
  );
}
