import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // /api/og 같은 Vercel edge fn 은 빌드 산출물에 없음 — service worker 가 가로채지 않게 정확히.
      registerType: "autoUpdate",
      // 새 버전 배포 시 즉시 클라이언트로 가져오기 (사용자가 한참 옛 셸 잡고 도는 사고 방지)
      includeAssets: ["favicon.svg", "og.svg"],
      manifest: {
        name: "Wedding OS",
        short_name: "Wedding OS",
        description: "결혼 준비를 한 곳에서 — 청첩장 · 식전영상 · 체크리스트",
        start_url: "/",
        display: "standalone",
        background_color: "#FAF8F5",
        theme_color: "#B8956A",
        orientation: "portrait",
        lang: "ko",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // 청첩장 셸 / 코드는 precache. 사진(idb:) 은 IndexedDB 라 SW 무관.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // /api/og 와 supabase 는 절대 캐시하지 말 것 (동적 데이터, 매번 fresh)
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/i\//],
        runtimeCaching: [
          {
            // /api/* (Vercel Edge Functions, 예: og) — 항상 네트워크. SW 가 가로채 캐시하면 OG 가 깨짐.
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },
          {
            // Google Fonts CSS — stale-while-revalidate (오프라인에서도 폰트 깨지지 않게)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-assets",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "jsdelivr-assets",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            // Supabase REST/Realtime — 캐시 X (실시간 데이터)
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/.*/i,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
