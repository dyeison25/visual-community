import { defineConfig } from "@playwright/test";
const baseURL = process.env.VC_PUBLIC_FRONTEND_URL;
const apiURL = process.env.VC_PUBLIC_API_URL;
if (!baseURL || !apiURL || ![baseURL, apiURL].every(value => new URL(value).protocol === "https:")) {
  throw new Error("Configura VC_PUBLIC_FRONTEND_URL y VC_PUBLIC_API_URL con las URLs HTTPS reales.");
}
if (process.env.VC_SMOKE_CREATE_TEST_ACCOUNTS !== "true") {
  throw new Error("Esta prueba crea y elimina exclusivamente sus cuentas temporales. Actívala con VC_SMOKE_CREATE_TEST_ACCOUNTS=true.");
}
process.env.VC_E2E_REAL = "true";
export default defineConfig({
  testDir: "./tests/production", timeout: 240000, expect: { timeout: 20000 }, workers: 1,
  reporter: "list", outputDir: "test-results/production",
  use: { baseURL, channel: "msedge", trace: "off", screenshot: "off", video: "off" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
