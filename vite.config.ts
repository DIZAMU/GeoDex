import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  // The release shown in the footer.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    tailwindcss(),
    // Installable and offline after the first load: the app shell, data,
    // geometry, content, flags and fonts are all precached. Landmark photos from Commons are
    // cached at runtime after their first view, never precached.
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
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,txt,json}"],
        globIgnores: ["og-image.png"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        // Take over the open page at once, so the first visit is already offline-ready.
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(upload|thumb)\.wikimedia\.org\//,
            handler: "CacheFirst",
            options: {
              cacheName: "commons-photos",
              expiration: { maxEntries: 300, maxAgeSeconds: 365 * 24 * 60 * 60 },
              // Plain <img> requests are cross-origin without CORS, so responses are opaque.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
