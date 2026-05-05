import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",
    trace: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 20_000
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  // Don't auto-start the dev server — the user already has one running on 3001
  // (background task throughout this build). If you want isolated runs later,
  // configure webServer here.
  reporter: [["list"], ["html", { open: "never" }]],
  fullyParallel: false  // share dev DB; serial for safety
})
