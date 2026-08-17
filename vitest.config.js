import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    restoreMocks: true,
    // Several test files exercise the real file-store fallback (no
    // DATABASE_URL) against the same server/data/repairscout.json — running
    // test files in parallel worker processes corrupts it (each worker has
    // its own in-process write queue, which doesn't protect across
    // processes). Production always has DATABASE_URL set, so this is a
    // test-environment concern, not a real one.
    fileParallelism: false,
  },
});
