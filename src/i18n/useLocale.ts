import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { db, SETTINGS_ROW_ID } from "@/db/db";
import { setLocale as storeLocale } from "@/db/settings";
import { writeLocaleMirror } from "./index";
import { isLocale, type Locale } from "./locales";

/** The stored locale, applied to i18next and the document, and a setter that persists it. */
export function useLocale() {
  const { i18n } = useTranslation();
  const stored = useLiveQuery(() => db.settings.get(SETTINGS_ROW_ID), []);
  const current: Locale = isLocale(i18n.language) ? i18n.language : "en";
  const locale: Locale = stored?.locale ?? current;

  useEffect(() => {
    document.documentElement.lang = locale;
    writeLocaleMirror(locale);
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [i18n, locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      void i18n.changeLanguage(next);
      void storeLocale(db, next);
    },
    [i18n],
  );

  return { locale, setLocale };
}
