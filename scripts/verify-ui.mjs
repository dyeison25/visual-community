import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const asset = /^\/assets\/[A-Za-z0-9_.-]+$/.test(pathname) ? pathname : pathname === "/favicon.svg" ? pathname : "/index.html";
  const type = asset.endsWith(".js") ? "text/javascript" : asset.endsWith(".css") ? "text/css" : asset.endsWith(".svg") ? "image/svg+xml" : "text/html";
  try { response.writeHead(200, { "Content-Type": type }); response.end(await readFile(resolve("Frontend/dist" + asset))); }
  catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(4173, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173/admin");
  await page.waitForURL("http://127.0.0.1:4173/login");
  await page.getByRole("heading", { name: "Qué bueno tenerte aquí." }).waitFor();
  await page.screenshot({ path: "artifacts/login-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/registro");
  await page.getByRole("heading", { name: "Construyamos comunidad." }).waitFor();
  await page.screenshot({ path: "artifacts/registro-mobile.png", fullPage: true });
  const mobileFits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  await page.goto("http://127.0.0.1:4173/login");
  await page.getByRole("heading", { name: "Qué bueno tenerte aquí." }).waitFor();
  if (!mobileFits || errors.length) throw new Error("La verificación visual detectó errores.");
  console.log(JSON.stringify({ productionBuildRenders: true, mobileFits, browserErrors: errors.length, screenshots: ["login-desktop.png", "registro-mobile.png"] }));
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
