export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_PREFERENCES = ["light", "dark", "auto"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";

/** The browser chrome colour per mode: the page background. */
export const THEME_COLOR: Record<Theme, string> = { light: "#f7fbfc", dark: "#0c1316" };

/** 1.0 had three named themes; they map onto the two modes. */
const LEGACY: Record<string, ThemePreference> = {
  atlas: "dark",
  minimal: "light",
  playful: "light",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** A stored preference from any version, as a 2.0 preference. */
export function normalizeThemePreference(value: unknown): ThemePreference {
  if (isThemePreference(value)) return value;
  if (typeof value === "string" && value in LEGACY)
    return LEGACY[value] ?? DEFAULT_THEME_PREFERENCE;
  return DEFAULT_THEME_PREFERENCE;
}

/** Auto follows the device: dark when it is dark, light otherwise. */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
  if (preference === "auto") return systemDark ? "dark" : "light";
  return preference;
}
