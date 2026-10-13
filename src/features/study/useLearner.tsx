import { useLiveQuery } from "dexie-react-hooks";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { type ContentIndex, loadContent } from "@/data/content";
import { useWorld } from "@/data/useWorld";
import type { WorldData } from "@/data/world";
import {
  DEVICE_ROW_ID,
  type DeviceSettingsRow,
  db,
  type HookVoteEvent,
  type ReviewEvent,
  SETTINGS_ROW_ID,
  type SettingsRow,
} from "@/db/db";
import { rebuildCardStates, schedulerFor } from "@/db/reviews";
import type { CardState } from "@/engine/scheduler";
import type { CardId } from "@/engine/types";

export type Learner = {
  world: WorldData;
  settings: SettingsRow;
  device: DeviceSettingsRow;
  states: Map<CardId, CardState>;
  events: ReviewEvent[];
  votes: HookVoteEvent[];
  content: ContentIndex;
  scheduler: ReturnType<typeof schedulerFor>;
};

const LearnerContext = createContext<Learner | null>(null);

/**
 * Loads everything the study screens need once, live from IndexedDB, above the router.
 * Screens then render with data on the first frame of every navigation, so moving between
 * them never shows a loading state.
 */
export function LearnerProvider({ children }: { children: ReactNode }) {
  const world = useWorld();
  const settings = useLiveQuery(() => db.settings.get(SETTINGS_ROW_ID), []);
  const device = useLiveQuery(() => db.deviceSettings.get(DEVICE_ROW_ID), []);
  const stateRows = useLiveQuery(() => db.cardState.toArray(), []);
  const events = useLiveQuery(() => db.reviewEvents.toArray(), []);
  const votes = useLiveQuery(() => db.hookVoteEvents.toArray(), []);
  const [content, setContent] = useState<ContentIndex | null>(null);
  useEffect(() => {
    let active = true;
    void loadContent().then((loaded) => {
      if (active) setContent(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const states = useMemo(() => new Map((stateRows ?? []).map((s) => [s.cardId, s])), [stateRows]);
  const retention = settings?.requestRetention;
  const params = settings?.fsrsParams;
  const scheduler = useMemo(
    () => schedulerFor({ requestRetention: retention ?? 0.9, fsrsParams: params ?? null }),
    [retention, params],
  );

  // cardState is only a cache (CLAUDE.md invariant 2): if it is missing at load while events
  // exist, rebuild it from the events instead of showing an empty learner. Checked once per
  // load: later, the two live queries update one after the other, and a fresh first review
  // would otherwise look like a missing cache for one render and remount the session.
  const [cache, setCache] = useState<"unchecked" | "rebuilding" | "ok">("unchecked");
  useEffect(() => {
    if (!stateRows || !events) return;
    if (cache === "rebuilding") {
      // Ready once the live query shows the rebuilt rows.
      if (stateRows.length > 0) setCache("ok");
      return;
    }
    if (cache !== "unchecked") return;
    if (stateRows.length === 0 && events.some((e) => e.scheduled)) {
      setCache("rebuilding");
      void rebuildCardStates(db, scheduler).then(
        (count) => count === 0 && setCache("ok"),
        () => setCache("ok"),
      );
    } else {
      setCache("ok");
    }
  }, [stateRows, events, scheduler, cache]);

  const learner = useMemo(
    () =>
      world &&
      settings &&
      device &&
      stateRows &&
      events &&
      votes &&
      content &&
      // Until the cache is known to be there, show loading rather than an empty learner.
      cache === "ok"
        ? { world, settings, device, states, events, votes, content, scheduler }
        : null,
    [world, settings, device, stateRows, events, votes, content, states, scheduler, cache],
  );
  return <LearnerContext.Provider value={learner}>{children}</LearnerContext.Provider>;
}

/** The learner from the nearest LearnerProvider. Null while it loads. */
export function useLearner(): Learner | null {
  return useContext(LearnerContext);
}
