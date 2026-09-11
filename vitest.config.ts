import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Widened from "src/lib/**/*.test.ts" to also cover route handler tests
    // under src/app/api/**/*.test.ts, which call the exported `GET`
    // functions directly with a constructed `Request` rather than booting a
    // server.
    include: ["src/**/*.test.ts"],
    // The scaffold ships with no test files yet (later batches add
    // src/lib/**/*.test.ts). Without this, `vitest run` exits non-zero on
    // an empty suite, which would make the toolchain gate green-by-accident
    // rather than a meaningful pass/fail signal.
    passWithNoTests: true,
  },
});
