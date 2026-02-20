// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";

// https://astro.build/config
export default defineConfig({
  site: "https://benitorhuang-svg.github.io",
  base: "/flutter_fourier3d",
  integrations: [
    AstroPWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
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
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('three')) {
                return 'three';
              }
              return 'vendor';
            }
          }
        }
      }
    }
  },
});
