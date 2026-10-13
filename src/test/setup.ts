import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
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

if (typeof document !== "undefined") initI18n("en");
