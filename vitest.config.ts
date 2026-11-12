import { mergeConfig } from "vite";
import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
      setupFiles: ["./src/test/setup.ts"],
      // The engine is the tested core: CI fails below 90% of its lines.
      coverage: {
        provider: "v8",
        include: ["src/engine/**/*.ts"],
        exclude: ["**/*.test.ts"],
        reporter: ["text-summary", "json-summary"],
        thresholds: { lines: 90 },
      },
    },
  }),
);
