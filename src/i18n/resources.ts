import en from "./en.json";
import type { Locale } from "./locales";
import nb from "./nb.json";

/** Dotted paths to every string in a nested translation object. */
export type KeyPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${KeyPaths<T[K]>}`;
}[keyof T & string];

type SameKeys<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

/** Fails typecheck when en.json and nb.json do not have exactly the same keys. */
export type LocaleKeyParity = Assert<SameKeys<KeyPaths<typeof en>, KeyPaths<typeof nb>>>;

export type TranslationKey = KeyPaths<typeof en>;

export const resources = {
  en: { translation: en },
  nb: { translation: nb },
} as const satisfies Record<Locale, { translation: unknown }>;
