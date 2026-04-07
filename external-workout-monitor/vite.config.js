import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pocket-192.svg", "pocket-512.svg"],
      manifest: {
        name: "Feeder Pocket",
        short_name: "Feeder Pocket",
        description: "Pocket-sized live workout monitor for Feeder.",
        theme_color: "#0d1b2a",
        background_color: "#f4edd8",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/pocket-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/pocket-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
  },
});
