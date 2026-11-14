import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/**
 * The headers in public/_headers that apply to every path. `vite preview` sends them too, so the
 * end-to-end tests run under the same content security policy as the live site.
 */
function siteHeaders(): Record<string, string> {
  const text = readFileSync(new URL("./public/_headers", import.meta.url), "utf8");
  const headers: Record<string, string> = {};
  let inAll = false;
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inAll = line.trim() === "/*";
      continue;
    }
    const at = line.indexOf(":");
    if (inAll && at > 0) headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return headers;
}

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
        // The demo video is a file to open, not a page of the app.
        navigateFallbackDenylist: [/\.mp4$/],
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
  preview: { headers: siteHeaders() },
  build: {
    // Keep data files as real files. Inlined they become data: URLs, which the
    // content security policy in public/_headers refuses to fetch.
    assetsInlineLimit: (file) => (file.endsWith(".json") ? false : undefined),
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
