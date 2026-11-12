import {
  CalendarCheckIcon,
  ChartColumnIcon,
  CircleHelpIcon,
  type LucideIcon,
  MapIcon,
  SettingsIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router";
import { BackToTop } from "@/ui/back-to-top";
import { cn } from "@/ui/utils";
import lockup from "../../assets/brand/svg/geodex-lockup.svg";
import lockupOnDark from "../../assets/brand/svg/geodex-lockup-on-dark.svg";
import { SiteFooter } from "./SiteFooter";

type Item = {
  to: string;
  key: "nav.today" | "nav.atlas" | "nav.stats" | "nav.settings" | "help.button";
  icon: LucideIcon;
  end?: boolean;
};

const ITEMS: Item[] = [
  { to: "/", key: "nav.today", icon: CalendarCheckIcon, end: true },
  { to: "/atlas", key: "nav.atlas", icon: MapIcon },
  { to: "/stats", key: "nav.stats", icon: ChartColumnIcon },
  { to: "/settings", key: "nav.settings", icon: SettingsIcon },
  { to: "/help", key: "help.button", icon: CircleHelpIcon },
];

/**
 * Shell for the quiet screens. On a phone the five destinations sit in a
 * bar at the bottom, in thumb reach; from 640 px they move into the header as text links.
 * Session screens use the full viewport and no shell.
 */
export function AppLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 [view-transition-name:site-header] border-b border-border bg-background">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:h-14 md:px-10">
          {/* The wordmark is artwork, never live text (assets/brand/BRAND.md). */}
          <Link to="/" viewTransition className="flex h-11 items-center rounded-lg">
            <img src={lockup} alt={t("app.name")} className="brand-on-light h-6 w-auto sm:h-7" />
            <img
              src={lockupOnDark}
              alt={t("app.name")}
              className="brand-on-dark h-6 w-auto sm:h-7"
            />
          </Link>
          <nav aria-label={t("nav.label")} className="hidden h-full items-stretch gap-1 sm:flex">
            {ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                viewTransition
                data-testid={item.to === "/help" ? "help-button" : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center border-b-2 border-transparent px-3 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    isActive && "border-foreground font-medium text-foreground",
                  )
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      {/* On a phone the bottom bar covers the last 4rem, so the page leaves room for it. The main
          area takes the spare height, so a short page still has the footer at the bottom. */}
      <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <BackToTop />
      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
        data-testid="bottom-nav"
      >
        <ul className="grid grid-cols-5">
          {ITEMS.map(({ to, key, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                viewTransition
                data-testid={`nav-${to === "/" ? "today" : to.slice(1)}`}
                className={({ isActive }) =>
                  cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                    isActive && "font-medium text-foreground",
                  )
                }
              >
                <Icon aria-hidden className="size-5" strokeWidth={1.75} />
                {t(key)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
