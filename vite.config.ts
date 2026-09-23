import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

const single = process.env.PACK_SINGLE === "1";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3847,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 3847,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: single ? 100000000 : 4096,
    cssCodeSplit: !single,
  },
});
