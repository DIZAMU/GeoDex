import {
  BarChart3Icon,
  CalendarCheckIcon,
  type LucideIcon,
  MapIcon,
  SettingsIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router";
import { cn } from "@/ui/utils";
import lockup from "../../assets/brand/svg/geodex-lockup.svg";
import lockupOnDark from "../../assets/brand/svg/geodex-lockup-on-dark.svg";

function NavItem({
  to,
  label,
  icon: Icon,
  end = false,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}) {
  return (
    <NavLink
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
            <NavItem to="/atlas" label={t("nav.atlas")} icon={MapIcon} />
            <NavItem to="/stats" label={t("nav.stats")} icon={BarChart3Icon} />
            <NavItem to="/settings" label={t("nav.settings")} icon={SettingsIcon} />
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
