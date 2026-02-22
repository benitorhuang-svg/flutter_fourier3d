import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";
import node from "@astrojs/node";

export default defineConfig({
  site: "https://benitorhuang-svg.github.io",
  base: "/flutter_fourier3d",
  output: "server",

  integrations: [
    AstroPWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
        navigateFallback: '/flutter_fourier3d/',
        suppressWarnings: true
      },
      manifest: {
        name: "Fourier 3D",
        short_name: "Fourier3D",
        description: "Harmonic Synthesis Visualizer",
        theme_color: "#020208",
        background_color: "#020208",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,png,webmanifest}"],
        maximumFileSizeToCacheInBytes: 5000000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Cache streaming audio or external assets if needed
            urlPattern: /.*(?:mp3|audio).*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'audio-streams-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    server: {
      hmr: {
        clientPort: 4321,
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('three')) return 'three';
              if (id.includes('nanostores')) return 'nanostores';
              return 'vendor';
            }
          }
        }
      }
    }
  },

  adapter: node({
    mode: "standalone",
  }),
});