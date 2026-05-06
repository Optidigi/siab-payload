import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**"],
    globals: true,
    pool: "forks",
    // Integration tests share a single Postgres test DB; running them in
    // parallel forks creates slug collisions and visibility races. Force
    // a single fork so all test files run sequentially.
    poolOptions: { forks: { singleFork: true } },
    // Also disable parallel file execution on top of singleFork for safety.
    fileParallelism: false,
    testTimeout: 30000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Stub Next.js' `server-only` marker — not installed in this repo
      // (Next bundles it implicitly), so vitest fails to resolve it
      // when a unit test imports a module guarded by `import "server-only"`.
      "server-only": path.resolve(__dirname, "tests/__mocks__/server-only.ts"),
    }
  }
})
