/**
 * Help (PLAN.md 11.1): a clickable map of the app, how grading and scheduling work, the
 * level path, and a way back to the tour and the welcome page.
 */
import {
  ArrowDownIcon,
  ArrowRightIcon,
  BarChart3Icon,
  CalendarCheckIcon,
  CheckCheckIcon,
  CompassIcon,
  KeyboardIcon,
  type LucideIcon,
  MapIcon,
  PlayIcon,
  RefreshCwIcon,
  SettingsIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  TrophyIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { db } from "@/db/db";
import { setTourDone } from "@/db/settings";
import { Button } from "@/ui/button";
import { LevelPath } from "../welcome/LevelPath";

type NodeId = "welcome" | "today" | "session" | "atlas" | "stats" | "settings";

const NODES: Record<NodeId, { icon: LucideIcon; to: string }> = {
  welcome: { icon: SparklesIcon, to: "/welcome" },
  today: { icon: CalendarCheckIcon, to: "/" },
  session: { icon: PlayIcon, to: "/" },
  atlas: { icon: MapIcon, to: "/atlas" },
  stats: { icon: BarChart3Icon, to: "/stats" },
  settings: { icon: SettingsIcon, to: "/settings" },
};

export function HelpScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-10 md:py-12">
      <div className="stagger flex flex-col gap-2">
        <h1 className="font-name text-4xl tracking-tight">{t("help.title")}</h1>
        <p className="max-w-[60ch] text-lg text-muted-foreground">{t("help.lead")}</p>
      </div>

      <section aria-labelledby="appmap-title" className="flex flex-col gap-5" data-testid="app-map">
        <h2 id="appmap-title" className="flex items-center gap-2 font-name text-2xl">
          <CompassIcon aria-hidden className="size-6 text-primary" />
          {t("help.mapTitle")}
        </h2>
        <div className="surface flex flex-col items-stretch gap-3 p-5 md:p-8">
          {/* Main path: welcome, then Today, then a session. */}
          <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <MapNode id="welcome" />
            <Connector />
            <MapNode id="today" hub />
            <Connector />
            <MapNode id="session" note={t("help.startsFrom")} />
          </div>
          {/* Today also leads to the three side screens. */}
          <div className="flex justify-center md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <span aria-hidden className="md:col-start-3 flex justify-center">
              <ArrowDownIcon className="size-5 text-muted-foreground" />
            </span>
          </div>
          <div className="relative grid gap-3 md:grid-cols-3">
            <span
              aria-hidden
              className="absolute -top-2 right-[16.7%] left-[16.7%] hidden h-px bg-border md:block"
            />
            <MapNode id="atlas" />
            <MapNode id="stats" />
            <MapNode id="settings" />
          </div>
        </div>
      </section>

      <section aria-labelledby="how-title" className="flex flex-col gap-5">
        <h2 id="how-title" className="sr-only">
          {t("help.title")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <HelpCard icon={CheckCheckIcon} title={t("help.gradingTitle")}>
            {t("help.gradingBody")}
          </HelpCard>
          <HelpCard icon={TrendingUpIcon} title={t("help.harderTitle")}>
            {t("help.harderBody")}
          </HelpCard>
          <HelpCard icon={RefreshCwIcon} title={t("help.scheduleTitle")}>
            {t("help.scheduleBody")}
          </HelpCard>
          <HelpCard icon={KeyboardIcon} title={t("help.keysTitle")}>
            {t("help.keysBody")}
          </HelpCard>
          <HelpCard icon={TrophyIcon} title={t("help.xpTitle")}>
            {t("help.xpBody")}
          </HelpCard>
          <HelpCard icon={TargetIcon} title={t("help.goalTitle")}>
            {t("help.goalBody")}
          </HelpCard>
        </div>
      </section>

      <section aria-labelledby="levels-title" className="surface flex flex-col gap-4 p-6 md:p-8">
        <h2 id="levels-title" className="font-name text-2xl">
          {t("welcome.levelsTitle")}
        </h2>
        <p className="max-w-[65ch] text-muted-foreground">{t("welcome.levelsBody")}</p>
        <LevelPath />
      </section>

      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          data-testid="replay-tour"
          onClick={async () => {
            await setTourDone(db, null);
            navigate("/", { viewTransition: true });
          }}
        >
          <PlayIcon aria-hidden />
          {t("help.replayTour")}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/welcome" viewTransition data-testid="show-welcome">
            <SparklesIcon aria-hidden />
            {t("help.showWelcome")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function MapNode({ id, hub = false, note }: { id: NodeId; hub?: boolean; note?: string }) {
  const { t } = useTranslation();
  const { icon: Icon, to } = NODES[id];
  return (
    <Link
      to={to}
      viewTransition
      data-testid={`appmap-${id}`}
      className={`group flex h-full items-start gap-3 rounded-xl border p-4 transition-[transform,border-color,background-color] duration-200 ease-(--ease-ui) hover:-translate-y-0.5 hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none motion-reduce:hover:translate-y-0 ${hub ? "border-primary/60 bg-primary/10" : "border-border bg-background/40"}`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${hub ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"}`}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-name text-lg">{t(`help.nodes.${id}.name`)}</span>
        <span className="text-sm text-muted-foreground">{t(`help.nodes.${id}.body`)}</span>
        {note ? <span className="text-xs text-muted-foreground italic">{note}</span> : null}
      </span>
    </Link>
  );
}

function Connector() {
  return (
    <span aria-hidden className="flex justify-center text-muted-foreground">
      <ArrowRightIcon className="hidden size-5 md:block" />
      <ArrowDownIcon className="size-5 md:hidden" />
    </span>
  );
}

function HelpCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="surface flex flex-col gap-3 p-6">
      <h3 className="flex items-center gap-3 font-name text-xl">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon aria-hidden className="size-5" />
        </span>
        {title}
      </h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
