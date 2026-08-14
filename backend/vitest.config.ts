import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Provider and config modules read env at import time, so each file gets a
    // fresh module registry to keep per-test env setup from leaking.
    isolate: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/providers/**", "src/validators/**", "src/utils/**"],
    },
  },
});
