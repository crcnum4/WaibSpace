import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@waibspace/types": path.resolve(
        __dirname,
        "../../packages/types/src/index.ts"
      ),
      "@waibspace/ui-renderer-contract": path.resolve(
        __dirname,
        "../../packages/ui-renderer-contract/src/index.ts"
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
