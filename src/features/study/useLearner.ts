import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
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

/** Everything the study screens need, live from IndexedDB. Null while loading. */
export function useLearner(): Learner | null {
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

  if (!world || !settings || !device || !stateRows || !events) return null;
  return { world, settings, device, states, events, scheduler };
}
