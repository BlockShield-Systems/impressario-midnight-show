import {
  defineConfig,
  devices
} from "@playwright/test";

const externalServer =
  process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,

  expect: {
    timeout: 10_000
  },

  reporter: [
    ["list"]
  ],

  use: {
    baseURL,
    trace:
      "retain-on-failure",
    screenshot:
      "only-on-failure",
    video:
      "retain-on-failure",

    ...devices[
      "Desktop Chrome"
    ]
  },

  webServer: externalServer
    ? undefined
    : {
        command:
          "npm run dev -- --host 127.0.0.1 --port 4173",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe"
      }
});
