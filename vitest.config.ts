/** Vitest configuration for unit tests. Runs in a jsdom environment. */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // Without this Vitest resolves `*.css?inline` to an empty string, so the
    // tests that assert on injected rules would pass against no CSS at all.
    // Unanchored because the module id keeps its `?inline` query.
    css: { include: [/markdownReview\.css/] },
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
    },
  },
});
