export const THEMES = ["atlas", "minimal", "playful"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_PREFERENCES = ["atlas", "minimal", "playful", "auto"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "atlas";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Auto follows the system: Atlas when dark, Minimal when light. */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
  if (preference === "auto") return systemDark ? "atlas" : "minimal";
  return preference;
}
