import { defineConfig } from "@playwright/test";
const deployedURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: deployedURL || "http://localhost:3000",
    headless: true,
    channel: "chrome",
    viewport: { width: 1536, height: 1024 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: deployedURL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 60000,
      },
});
