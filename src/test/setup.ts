import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { readFile } from "node:fs/promises";
import { initI18n } from "@/i18n";

// jsdom has no matchMedia. Tests that need a specific answer stub it themselves.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom has no ResizeObserver. The map measures its container with it; in tests it stays 0x0.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// The world data loads with fetch from same-origin URLs (`/data/countries.json` in tests).
// Serve those from disk; anything else still goes to the real fetch.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith("/data/") && url.endsWith(".json")) {
    return new Response(await readFile(`.${url.split("?")[0]}`), {
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

if (typeof document !== "undefined") initI18n("en");
