import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    // single JS + single CSS chunk so the bundle is easy to inline into index.html
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    rollupOptions: { output: { manualChunks: undefined } },
  },
});
