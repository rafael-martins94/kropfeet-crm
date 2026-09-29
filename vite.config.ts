import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { sumupApiPlugin } from "./vite/sumupApi";

export default defineConfig({
  plugins: [react(), sumupApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
