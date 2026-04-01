import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "PetMood - Pet Wellness Notifications",
    description:
      "Your pet sends you encouraging messages while you browse! All AI processing runs locally in your browser.",
    version: "0.1.0",
    default_locale: "en",
    permissions: [
      "alarms",
      "storage",
      "unlimitedStorage",
      "offscreen",
      "activeTab",
      "idle",
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
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
