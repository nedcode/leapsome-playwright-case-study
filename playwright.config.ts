import { defineConfig, devices } from "@playwright/test";
import { API_BASE_URL, AUTH_STATE_PATH, CLIENT_BASE_URL, CLIENT_PORT } from "./tests/support/env";

const isCI = Boolean(process.env.CI);
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: isCI ? 2 : undefined,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["list"], ["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/global-setup.ts",
  // Sign-in hashes the password with bcrypt (cost 12), which can take several seconds on a busy CI runner.
  expect: { timeout: 10_000 },
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: "node ./node_modules/ts-node/dist/bin.js --project tsconfig.server.json src/api/server.ts",
          url: `${API_BASE_URL}/auth/users`,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
        {
          command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${CLIENT_PORT} --strictPort`,
          url: CLIENT_BASE_URL,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      ],
  projects: [
    {
      name: "api",
      testDir: "./tests/api",
      use: { baseURL: API_BASE_URL },
    },
    {
      name: "setup",
      testDir: "./tests/e2e",
      testMatch: /.*\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: CLIENT_BASE_URL },
    },
    {
      name: "e2e-chromium",
      testDir: "./tests/e2e",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], baseURL: CLIENT_BASE_URL, storageState: AUTH_STATE_PATH },
    },
    {
      name: "e2e-firefox",
      testDir: "./tests/e2e",
      dependencies: ["setup"],
      use: { ...devices["Desktop Firefox"], baseURL: CLIENT_BASE_URL, storageState: AUTH_STATE_PATH },
    },
  ],
});
