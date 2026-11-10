/**
 * The footer on the welcome page and every app screen: the name and a line on what GeoDex is,
 * three short columns of links, and a closing line with the year, the author and the release.
 * Quiet and compact; the session screens have no footer.
 */
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { db } from "@/db/db";
import { setTourDone } from "@/db/settings";
import lockup from "../../assets/brand/svg/geodex-lockup.svg";
import lockupOnDark from "../../assets/brand/svg/geodex-lockup-on-dark.svg";

const AUTHOR_URL = "https://github.com/DIZAMU";

const linkClass =
  "rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function SiteFooter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const columns: {
    title: string;
    links: { label: string; to?: string; onClick?: () => void }[];
  }[] = [
    {
      title: t("footer.learn"),
      links: [
        { label: t("nav.today"), to: "/" },
        { label: t("nav.atlas"), to: "/atlas" },
        { label: t("nav.stats"), to: "/stats" },
      ],
    },
    {
      title: t("footer.help"),
      links: [
        { label: t("footer.questions"), to: "/help" },
        { label: t("footer.backup"), to: "/settings?tab=backup" },
        {
          label: t("footer.tour"),
          onClick: async () => {
            await setTourDone(db, null);
            navigate("/", { viewTransition: true });
          },
        },
      ],
    },
    {
      title: t("footer.about"),
      links: [
        { label: t("footer.welcome"), to: "/welcome" },
        { label: t("nav.settings"), to: "/settings" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border" data-testid="site-footer">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 md:px-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="flex max-w-xs flex-col gap-2">
            <Link to="/" viewTransition className="self-start rounded-sm" aria-label="GeoDex">
              <img src={lockup} alt="" className="brand-on-light h-6 w-auto" />
              <img src={lockupOnDark} alt="" className="brand-on-dark h-6 w-auto" />
            </Link>
            <p className="text-sm text-muted-foreground">{t("footer.tagline")}</p>
            <p className="text-xs text-muted-foreground">{t("footer.privacy")}</p>
          </div>
          <nav aria-label={t("footer.about")} className="grid grid-cols-3 gap-6 sm:gap-12">
            {columns.map((column) => (
              <div key={column.title} className="flex flex-col gap-2 text-sm">
                <p className="font-medium">{column.title}</p>
                <ul className="flex flex-col gap-1.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link to={link.to} viewTransition className={linkClass}>
                          {link.label}
                        </Link>
                      ) : (
                        <button type="button" onClick={link.onClick} className={linkClass}>
                          {link.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p data-testid="footer-credit">
            © GeoDex · {t("footer.credit")}{" "}
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              DIZAMU
            </a>
          </p>
          <div className="flex items-center gap-4">
            <span>{t("footer.version", { version: __APP_VERSION__ })}</span>
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1.5 ${linkClass}`}
              data-testid="footer-github"
            >
              <GitHubMark />
              {t("footer.github")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** The GitHub mark, inline: the icon set carries no brand logos. */
function GitHubMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 fill-current">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
