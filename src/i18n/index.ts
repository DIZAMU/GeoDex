import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { detectLocale, isLocale, type Locale } from "./locales";
import { resources } from "./resources";

/** Mirror of the stored locale, read synchronously so the first paint uses the right language. */
export const LOCALE_MIRROR_KEY = "geodex.locale";

export function readLocaleMirror(): Locale | undefined {
  try {
    const value = localStorage.getItem(LOCALE_MIRROR_KEY);
    return isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeLocaleMirror(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_MIRROR_KEY, locale);
  } catch {
    // Storage can be unavailable (private mode); Dexie stays the source of truth.
  }
}

export function initialLocale(): Locale {
  return readLocaleMirror() ?? detectLocale(navigator.languages);
}

export function initI18n(lng: Locale) {
  document.documentElement.lang = lng;
  void i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "en",
    supportedLngs: ["en", "nb"],
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18next;
}
