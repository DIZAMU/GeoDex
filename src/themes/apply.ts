import {
  DEFAULT_THEME_PREFERENCE,
  normalizeThemePreference,
  resolveTheme,
  THEME_COLOR,
  type ThemePreference,
} from "./themes";

/**
 * Mirror of the stored preference, read synchronously by public/theme-boot.js (loaded from
 * index.html) so the first paint uses the right theme. Dexie stays the source of truth.
 */
export const THEME_MIRROR_KEY = "geodex.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readThemeMirror(): ThemePreference {
  try {
    return normalizeThemePreference(localStorage.getItem(THEME_MIRROR_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function writeThemeMirror(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_MIRROR_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this page.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  const theme = resolveTheme(preference, systemPrefersDark());
  root.dataset.theme = theme;
  root.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  writeThemeMirror(preference);
}

/** Re-applies Auto when the system switches between light and dark. Returns an unsubscribe. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
