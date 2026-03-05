import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import vike from "vike/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    vike(),
    sentryVitePlugin({
      sourcemaps: {
        disable: false,
      },
    }),
    tailwindcss(),
    vue(),
  ],

  build: {
    sourcemap: true,
  },
});
