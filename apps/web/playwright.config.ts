import { defineConfig, devices } from "@playwright/test";

import { loadWebEnv } from "./e2e/support/load-env";

// Load apps/web/.env into the runner before config reads env (Clerk + Supabase
// keys, the API base URL, and the E2E test-user password).
loadWebEnv();

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/*.capture.ts"],
  // Auth + a shared live DB make parallel writes racy; keep it serial.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  // Reuse the dev servers if they're already up (local), otherwise start them.
  webServer: [
    {
      command: "npm run dev",
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command:
        "cd ../api && .venv/bin/python -m uvicorn app.main:app --port 8000",
      url: "http://localhost:8000/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
