import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router";
import { cn } from "@/ui/utils";
import lockup from "../../assets/brand/svg/geodex-lockup.svg";
import lockupOnDark from "../../assets/brand/svg/geodex-lockup-on-dark.svg";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center rounded-md px-3 hover:bg-muted",
          isActive && "font-name shadow-[inset_0_-3px_0_var(--primary)]",
        )
      }
    >
      {label}
    </NavLink>
  );
}

/** Shell for the quiet screens (Today, Settings). Session screens use the full viewport. */
export function AppLayout() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-10">
        {/* The wordmark is artwork, never live text (assets/brand/BRAND.md). */}
        <span className="flex h-7 items-center">
          <img src={lockup} alt={t("app.name")} className="brand-on-light h-7 w-auto" />
          <img src={lockupOnDark} alt={t("app.name")} className="brand-on-dark h-7 w-auto" />
        </span>
        <nav className="flex gap-1">
          <NavItem to="/" label={t("nav.today")} />
          <NavItem to="/settings" label={t("nav.settings")} />
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
