import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { type DrillTarget, drillQueue } from "@/engine/drill";
import { Button } from "@/ui/button";
import { Loader } from "@/ui/loader";
import { Session } from "../session/SessionScreen";
import { scopedCountries } from "../study/plan";
import { type Learner, useLearner } from "../study/useLearner";

/** /drill?region=<M49> or /drill?a=<ISO3>&b=<ISO3> */
export function parseDrillTarget(params: URLSearchParams): DrillTarget | null {
  const region = params.get("region");
  if (region) return { kind: "region", subregion: region };
  const a = params.get("a");
  const b = params.get("b");
  return a && b && a !== b ? { kind: "pair", a, b } : null;
}

export function DrillScreen() {
  const learner = useLearner();
  const [params] = useSearchParams();
  if (!learner) return <Loader />;
  return <Drill learner={learner} target={parseDrillTarget(params)} />;
}

function Drill({ learner, target }: { learner: Learner; target: DrillTarget | null }) {
  const { t } = useTranslation();
  // Seeded by the event count, so each drill differs but a reload reproduces it.
  const [queue] = useState(() =>
    target
      ? drillQueue({
          target,
          countries: scopedCountries(learner.world, learner.settings),
          states: learner.states,
          seed: `drill:${JSON.stringify(target)}#${learner.events.length}`,
        })
      : [],
  );
  if (queue.length === 0) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-16">
        <div className="surface flex w-full max-w-md flex-col gap-5 p-8" data-testid="drill-empty">
          <h1 className="font-name text-3xl tracking-tight">{t("drill.title")}</h1>
          <p className="text-muted-foreground">{t("drill.empty")}</p>
          <Button asChild size="lg" className="self-start">
            <Link to="/atlas" viewTransition>
              {t("entry.back")}
            </Link>
          </Button>
        </div>
      </main>
    );
  }
  return (
    <Session
      learner={learner}
      input={learner.device.lastInputMode}
      kind={{ kind: "drill", queue }}
    />
  );
}
