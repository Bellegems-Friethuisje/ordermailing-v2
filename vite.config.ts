import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import vike from "vike/plugin";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  plugins: [
    vike(),
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Ordermailing",
        short_name: "Ordermailing",
        description: "Ordermailing dashboard",
        theme_color: "#1a1a1a",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: null,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
    sentryVitePlugin({
      sourcemaps: {
        disable: false,
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },

  build: {
    sourcemap: true,
  },
});
