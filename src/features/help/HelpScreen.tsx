/**
 * Help (docs/PLAN-2.0.md): the screens, how grading, scheduling and levels work, where
 * progress is kept, and a way back to the tour and the first screen. One column, plain.
 */
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { db } from "@/db/db";
import { setTourDone } from "@/db/settings";
import { Button } from "@/ui/button";
import { LevelPath } from "../welcome/LevelPath";

const SCREENS = [
  { id: "today", to: "/" },
  { id: "atlas", to: "/atlas" },
  { id: "stats", to: "/stats" },
  { id: "settings", to: "/settings" },
  { id: "welcome", to: "/welcome" },
] as const;

const TOPICS = [
  ["gradingTitle", "gradingBody"],
  ["harderTitle", "harderBody"],
  ["scheduleTitle", "scheduleBody"],
  ["goalTitle", "goalBody"],
  ["keysTitle", "keysBody"],
] as const;

export function HelpScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-4 py-8 md:py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium tracking-tight">{t("help.title")}</h1>
        <p className="text-lg text-muted-foreground">{t("help.lead")}</p>
      </div>

      <section
        aria-labelledby="screens-title"
        className="flex flex-col gap-3"
        data-testid="app-map"
      >
        <h2 id="screens-title" className="text-xl font-medium">
          {t("help.mapTitle")}
        </h2>
        <ul className="flex flex-col">
          {SCREENS.map(({ id, to }) => (
            <li key={id} className="border-b border-border">
              <Link
                to={to}
                viewTransition
                data-testid={`appmap-${id}`}
                className="flex flex-col gap-0.5 py-3 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium underline decoration-border underline-offset-4">
                  {t(`help.nodes.${id}.name`)}
                </span>
                <span className="text-sm text-muted-foreground">{t(`help.nodes.${id}.body`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {TOPICS.map(([title, body]) => (
        <section key={title} aria-labelledby={`help-${title}`} className="flex flex-col gap-2">
          <h2 id={`help-${title}`} className="text-xl font-medium">
            {t(`help.${title}`)}
          </h2>
          <p className="text-muted-foreground">{t(`help.${body}`)}</p>
        </section>
      ))}

      <section aria-labelledby="levels-title" className="flex flex-col gap-3">
        <h2 id="levels-title" className="text-xl font-medium">
          {t("help.xpTitle")}
        </h2>
        <p className="text-muted-foreground">{t("help.levelsBody")}</p>
        <p className="text-muted-foreground">{t("help.xpBody")}</p>
        <LevelPath />
      </section>

      <section aria-labelledby="progress-title" className="flex flex-col gap-2">
        <h2 id="progress-title" className="text-xl font-medium">
          {t("help.progressTitle")}
        </h2>
        <p className="text-muted-foreground">{t("help.progressBody")}</p>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-8">
        <Button
          variant="secondary"
          data-testid="replay-tour"
          onClick={async () => {
            await setTourDone(db, null);
            navigate("/", { viewTransition: true });
          }}
        >
          {t("help.replayTour")}
        </Button>
        <Button asChild variant="outline">
          <Link to="/welcome" viewTransition data-testid="show-welcome">
            {t("help.showWelcome")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
