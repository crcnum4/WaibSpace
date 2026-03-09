import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@waibspace/types": path.resolve(
        __dirname,
        "../../packages/types/src/index.ts",
      ),
      "@waibspace/ui-renderer-contract": path.resolve(
        __dirname,
        "../../packages/ui-renderer-contract/src/index.ts",
      ),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
    // Exclude bun:test files — they use a different test runner
    exclude: ["**/node_modules/**", "src/lib/**/*.test.ts"],
  },
});
