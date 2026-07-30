import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import vike from "vike/plugin";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, type Plugin } from "vite";
import path from "path";

// @node-escpos/core runs client-side, because the thermal printer is on the
// user's LAN and not reachable from the server (see the print handlers in
// pages/settings and pages/automaten). Its ESC/POS builder is pure JS, but
// the package's entry point also imports
// `get-pixels` (image printing) and `qr-image` (QR codes) at the top level. We
// use neither, yet both still have to *resolve* when bundling for a browser, and
// they drag in Node-only code that breaks on import - `get-pixels` alone pulls
// `fs`, `pngjs`, `through` and `mime-types`, and `pngjs` calls `util.inherits`
// while evaluating. Point them at an empty stub, for browser builds only, so the
// SSR build and the server keep the real modules.
//
// `stream` is stubbed for iconv-lite, which probes it at import time and quietly
// disables its (unused) streaming API when the module has no `Transform`.
const CLIENT_SHIMS = ["stream", "get-pixels", "qr-image"];
const SHIM_PATH = path.resolve(__dirname, "lib/shims/empty.ts");

// Applies during dependency pre-bundling (esbuild).
function esbuildNodeShims() {
  return {
    name: "node-shims",
    setup(build: any) {
      const filter = new RegExp(`^(node:)?(${CLIENT_SHIMS.join("|")})$`);
      build.onResolve({ filter }, () => ({ path: SHIM_PATH }));
    },
  };
}

// Applies to the module graph, browser environments only. Keyed on `consumer`
// rather than the environment name: the build runs more than one browser-targeted
// environment (Vike adds its own for the Vercel output) and only `consumer` is
// reliably "client" for all of them, while the SSR environment keeps the real
// Node modules.
function nodeShims(): Plugin {
  return {
    name: "node-shims",
    enforce: "pre",
    resolveId(source) {
      if (this.environment?.config.consumer !== "client") return null;
      return CLIENT_SHIMS.includes(source.replace(/^node:/, "")) ? SHIM_PATH : null;
    },
  };
}

export default defineConfig({
  plugins: [
    nodeShims(),
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

  environments: {
    client: {
      optimizeDeps: {
        // Pre-bundle the printer package so esbuild converts its CJS deps
        // (iconv-lite, mutable-buffer) to ESM for the browser; esbuildNodeShims()
        // handles the Node-only imports it reaches for.
        include: ["@node-escpos/core", "buffer"],
        esbuildOptions: { plugins: [esbuildNodeShims()] },
      },
    },
  },

  build: {
    sourcemap: true,
  },
});
