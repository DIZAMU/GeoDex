import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable and offline after the first load (PLAN.md 8.4): the app shell, data,
    // geometry, content, flags and fonts are all precached.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      includeAssets: ["favicon.ico", "favicon.svg", "apple-touch-icon.png", "flags/*.svg"],
      manifest: {
        name: "GeoDex",
        short_name: "GeoDex",
        description: "Spaced-repetition geography trainer, in English and Norwegian.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0E2433",
        theme_color: "#0E2433",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,txt}"],
        globIgnores: ["og-image.png"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        // Take over the open page at once, so the first visit is already offline-ready.
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
