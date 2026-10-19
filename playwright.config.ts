import { defineConfig } from "@playwright/test";
const real = process.env.VC_E2E_REAL === "true";
export default defineConfig({
  grep: process.env.VC_E2E_GREP ? new RegExp(process.env.VC_E2E_GREP) : undefined,
  testDir: "./tests/e2e", timeout: 90000, expect: { timeout: 15000 }, workers: 1,
  reporter: [["list"], ["html", { open: "never" }]], outputDir: "test-results",
  use: { baseURL: real ? "http://127.0.0.1:5173" : "http://127.0.0.1:5174", channel: "msedge", trace: real ? "off" : "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: real ? undefined : { command: "bun scripts/dev.ts --test", url: "http://127.0.0.1:5174/login", reuseExistingServer: false, timeout: 60000 },
});
