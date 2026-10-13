import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  resolveTheme,
  type ThemePreference,
} from "./themes";

/**
 * Mirror of the stored preference, read synchronously by the inline script in index.html so
 * the first paint uses the right theme. Dexie stays the source of truth.
 */
export const THEME_MIRROR_KEY = "geodex.theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readThemeMirror(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_MIRROR_KEY);
    return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
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
  root.dataset.theme = resolveTheme(preference, systemPrefersDark());
  root.dataset.themePreference = preference;
  writeThemeMirror(preference);
}

/** Re-applies Auto when the system switches between light and dark. Returns an unsubscribe. */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
