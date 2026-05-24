import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // Most pure-function tests don't need a long timeout.
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Only library code is unit-tested; UI components are exercised by
      // build + integration. The lib/ folder is the integrity-critical
      // surface (HMAC, status, rate limit) so we track coverage there.
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.{test,spec}.ts", "src/lib/prisma.ts"],
    },
  },
});
