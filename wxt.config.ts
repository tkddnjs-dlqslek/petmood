import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      64: "icon-64.png",
      128: "icon-128.png",
    },
    name: "PetMood - Pet Wellness Notifications",
    description:
      "Your pet pops up with cute animations while you browse! All AI processing runs locally in your browser.",
    version: "0.1.0",
    default_locale: "en",
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
    permissions: [
      "alarms",
      "storage",
      "unlimitedStorage",
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    action: {
      default_icon: {
        16: "icon-16.png",
        32: "icon-32.png",
        64: "icon-64.png",
        128: "icon-128.png",
      },
    },
    web_accessible_resources: [
      {
        resources: [
          "ort-wasm-simd-threaded.jsep.wasm",
          "ort-wasm-simd-threaded.jsep.mjs",
        ],
        matches: ["<all_urls>"],
      },
    ],
  },
});
