import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect } from "react";
import { DEVICE_ROW_ID, db } from "@/db/db";
import { setThemePreference } from "@/db/settings";
import { applyTheme, readThemeMirror, watchSystemTheme } from "./apply";
import { normalizeThemePreference, type ThemePreference } from "./themes";

/** The stored theme preference, applied to the document, and a setter that persists it. */
export function useTheme() {
  const stored = useLiveQuery(() => db.deviceSettings.get(DEVICE_ROW_ID), []);
  const preference: ThemePreference = stored
    ? normalizeThemePreference(stored.theme)
    : readThemeMirror();

  useEffect(() => {
    applyTheme(preference);
    if (preference !== "auto") return;
    return watchSystemTheme(() => applyTheme("auto"));
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    applyTheme(next);
    void setThemePreference(db, next);
  }, []);

  return { preference, setTheme };
}
