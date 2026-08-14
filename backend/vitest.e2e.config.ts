import { defineConfig } from "vitest/config";

// E2E runs against a real MySQL and the real Express stack, so it is kept out of
// the default unit run (`npm test`) and invoked explicitly via `npm run test:e2e`.
export default defineConfig({
  test: {
    include: ["src/e2e/**/*.e2e.ts"],
    environment: "node",
    globalSetup: ["./src/e2e/global-setup.ts"],
    // Tests share one database; running files in sequence keeps their data
    // isolation explicit rather than relying on cross-file luck.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
