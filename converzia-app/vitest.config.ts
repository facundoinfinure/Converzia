import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Use node for non-component tests, jsdom for component tests
    environmentMatchGlobs: [
      // UI component tests use jsdom
      ["src/__tests__/components/**", "jsdom"],
      // Everything else uses node (faster)
      ["**", "node"],
    ],
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/services/**", "src/lib/utils/**", "src/lib/validation/**", "src/app/api/**", "src/components/**"],
      exclude: ["src/__tests__/**"],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});








