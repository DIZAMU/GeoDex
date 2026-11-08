/**
 * Help (docs/PLAN-2.0.md): common questions on grading, difficulty, scheduling and the rest,
 * each opened on its own; then levels and XP with the path; then a way back to the tour and
 * the first screen. One column, plain.
 */
import { ChevronDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { db } from "@/db/db";
import { setTourDone } from "@/db/settings";
import { Button } from "@/ui/button";
import { LevelPath } from "../welcome/LevelPath";

/** Each question and the existing answer text it opens. */
const FAQ = [
  ["grading", "gradingBody"],
  ["harder", "harderBody"],
  ["schedule", "scheduleBody"],
  ["newCards", "newCardsBody"],
  ["goal", "goalBody"],
  ["progress", "progressBody"],
  ["keys", "keysBody"],
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

      {/* Native disclosure: keyboard and screen readers work without any script. */}
      <section aria-labelledby="faq-title" className="flex flex-col gap-3" data-testid="help-faq">
        <h2 id="faq-title" className="text-xl font-medium">
          {t("help.faqTitle")}
        </h2>
        <div className="flex flex-col border-t border-border">
          {FAQ.map(([id, body]) => (
            <details key={id} className="group border-b border-border" data-testid={`faq-${id}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                {t(`help.faq.${id}`)}
                <ChevronDownIcon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="max-w-[60ch] pb-5 text-muted-foreground">{t(`help.${body}`)}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="levels-title" className="flex flex-col gap-3">
        <h2 id="levels-title" className="text-xl font-medium">
          {t("help.xpTitle")}
        </h2>
        <p className="text-muted-foreground">{t("help.levelsBody")}</p>
        <p className="text-muted-foreground">{t("help.xpBody")}</p>
        <LevelPath />
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
