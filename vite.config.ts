import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Build version stamped in São Paulo / Brazil timezone (America/Sao_Paulo)
  const buildDate = new Date();
  const spParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(buildDate)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  const appVersion = `${spParts.year}.${spParts.month}.${spParts.day}.${spParts.hour}${spParts.minute}`;
  return {
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: "::",
    port: 8080,
    watch: {
      usePolling: true,
    },
    hmr: {
      overlay: false,
    },
  },
  optimizeDeps: {
    force: true,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mcpPlugin(),
    VitePWA({
      registerType: "prompt", // Changed to prompt for manual update control
      includeAssets: ["favicon.png", "levi-icon.svg", "placeholder.svg"],
      manifest: {
        name: "LEVI - Gerenciador de Escalas",
        short_name: "LEVI",
        description: "Gerencie escalas de departamentos de forma simples e eficiente",
        theme_color: "#10B981",
        background_color: "#10B981",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["**/wonderpush*"],
        navigateFallbackDenylist: [/^\/~oauth/, /^\/auth/],
        clientsClaim: true,
        skipWaiting: false, // Let user control when to update
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // More aggressive cache invalidation
        cleanupOutdatedCaches: true,
        // Import WonderPush into the PWA service worker
        importScripts: ["/push-handlers.js"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            // API calls - network first with fallback
            urlPattern: /\/rest\/v1\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2022",
    cssTarget: "chrome100",
  },

  };
});
