import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "PetMood - 반려동물 웰니스 알림",
    description:
      "당신의 반려동물이 브라우징 중 응원 메시지를 보내드려요! 모든 AI 처리는 브라우저 내에서 수행됩니다.",
    version: "0.1.0",
    default_locale: "ko",
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
