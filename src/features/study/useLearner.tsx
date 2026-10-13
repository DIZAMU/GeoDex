import { useLiveQuery } from "dexie-react-hooks";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useWorld } from "@/data/useWorld";
import type { WorldData } from "@/data/world";
import {
  DEVICE_ROW_ID,
  type DeviceSettingsRow,
  db,
  type ReviewEvent,
  SETTINGS_ROW_ID,
  type SettingsRow,
} from "@/db/db";
import { schedulerFor } from "@/db/reviews";
import type { CardState } from "@/engine/scheduler";
import type { CardId } from "@/engine/types";

export type Learner = {
  world: WorldData;
  settings: SettingsRow;
  device: DeviceSettingsRow;
  states: Map<CardId, CardState>;
  events: ReviewEvent[];
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

  const states = useMemo(() => new Map((stateRows ?? []).map((s) => [s.cardId, s])), [stateRows]);
  const retention = settings?.requestRetention;
  const params = settings?.fsrsParams;
  const scheduler = useMemo(
    () => schedulerFor({ requestRetention: retention ?? 0.9, fsrsParams: params ?? null }),
    [retention, params],
  );

  const learner = useMemo(
    () =>
      world && settings && device && stateRows && events
        ? { world, settings, device, states, events, scheduler }
        : null,
    [world, settings, device, stateRows, events, states, scheduler],
  );
  return <LearnerContext.Provider value={learner}>{children}</LearnerContext.Provider>;
}

/** The learner from the nearest LearnerProvider. Null while it loads. */
export function useLearner(): Learner | null {
  return useContext(LearnerContext);
}
