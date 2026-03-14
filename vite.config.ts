import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import vike from "vike/plugin";
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  plugins: [
    vike(),
    vue(),
    tailwindcss(),
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
