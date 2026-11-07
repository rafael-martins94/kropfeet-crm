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
  build: {
    rollupOptions: {
      // p.html é a mesma SPA, mas com título/descrição/imagem de prévia
      // próprios para os links de pedido (/p/:token) enviados no WhatsApp.
      input: {
        main: path.resolve(__dirname, "index.html"),
        p: path.resolve(__dirname, "p.html"),
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
