import { defineConfig } from "vite";

export default defineConfig({
  base: "./",

  build: {
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1800
  },

  server: {
    host: true,
    port: 5173
  },

  preview: {
    host: true,
    port: 4173
  }
});
