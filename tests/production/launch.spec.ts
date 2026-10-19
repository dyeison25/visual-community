import { test, expect, type Page } from "@playwright/test";
import { cleanupTestAccount, readTestState, setTestRole } from "../../Backend/scripts/test-support";
const api = process.env.VC_PUBLIC_API_URL!.replace(/\/$/, "");
const password = "ValidacionPublica2026!";
const created: { uid: string; email: string }[] = [];
test.afterEach(async () => {
  for (const account of created.splice(0)) await cleanupTestAccount(account.uid, account.email);
});
async function register(page: Page) {
  const email = `vc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.invalid`;
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill("Validación de lanzamiento");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  const pending = page.waitForResponse(response => response.url().includes("accounts:signUp") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  const account = { uid: (await response.json()).localId as string, email }; created.push(account);
  await expect(page).toHaveURL(/\/bienvenida$/);
  await page.getByRole("checkbox", { name: "Comunidades energéticas", exact: true }).check();
  await page.getByRole("button", { name: /continuar|guardar|empezar/i }).click();
  await expect(page).toHaveURL(/\/$/);
  return account;
}
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.locator(".topbar")).toBeVisible();
  await expect(page).not.toHaveURL(/\/bienvenida$/);
}
test("lanzamiento: sesión, preferencias, fuentes, búsqueda, chat y permisos administrativos", async ({ page, browser, request }) => {
  const health = await request.get(api + "/api/health"); expect(health.ok()).toBe(true);
  expect((await health.json()).authMode).toBe("firebase");
  expect((await request.get(api + "/api/admin/summary")).status()).toBe(401);
  await page.goto("/admin"); await expect(page).toHaveURL(/\/login$/);
  const account = await register(page);
  await page.reload(); await expect(page.locator(".topbar")).toBeVisible();
  await expect(page.locator(".discovery-card").first()).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 90000 });
  await page.goto("/perfil");
  await expect(page.locator(".activity-stats")).toHaveCount(0);
  await page.getByRole("button", { name: "Editar mis preferencias" }).click();
  await page.getByRole("checkbox", { name: "Normativa y regulación energética", exact: true }).check();
  await page.getByRole("button", { name: "Guardar preferencias", exact: true }).click();
  await expect(page.getByText("Tus preferencias se actualizaron correctamente.")).toBeVisible();
  await page.goto("/admin"); await expect(page).toHaveURL(/\/$/);
  await page.goto("/comunidades");
  await page.getByRole("button", { name: "Ver información", exact: true }).first().click();
  const link = page.getByRole("dialog").getByRole("link", { name: "Consultar fuente oficial" });
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^https:\/\//); expect(href).not.toMatch(/MapServer|FeatureServer|\/query|\.json/i);
  const popupPromise = page.waitForEvent("popup"); await link.click(); const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  expect(await popup.locator("body").innerText()).not.toMatch(/no encontramos el contenido que buscas|url bloqueada|pagina web bloqueda|access denied/i);
  await popup.close();
  await page.goto("/normativa"); await expect(page.getByRole("button", { name: "Resolución CREG 101 072 de 2025", exact: true })).toBeVisible();
  await page.goto("/datos"); await expect(page.locator(".metric-value").first()).toBeVisible();
  await expect(page.locator(".metric-value").first()).not.toContainText("Sin datos");
  await page.goto("/buscar"); await page.getByLabel("¿Qué quieres consultar?").fill("comunidades");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.locator(".discovery-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Abrir asistente" }).click();
  await page.getByLabel("Tu pregunta").fill("¿Qué es una comunidad energética?");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.locator(".chat-message.assistant")).toBeVisible({ timeout: 70000 });
  await expect(page.locator(".chat-sources a").first()).toBeVisible();
  await page.getByRole("button", { name: "Cerrar asistente" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  await login(page, account.email);
  const state = await readTestState(account.uid, account.email);
  expect(state.profile?.preferences.topics).toContain("regulation");
  expect(state.events.map(event => "eventType" in event ? event.eventType : null)).toEqual(expect.arrayContaining(["REGISTER", "COMPLETE_ONBOARDING", "LOGIN", "LOGOUT", "SEARCH", "CHAT_QUERY", "CHAT_RESPONSE"]));
  const adminContext = await browser.newContext({ baseURL: process.env.VC_PUBLIC_FRONTEND_URL, viewport: page.viewportSize()!, isMobile: test.info().project.name === "mobile", hasTouch: test.info().project.name === "mobile" });
  try {
    const admin = await adminContext.newPage();
    const administrator = await register(admin);
    await setTestRole(administrator.uid, administrator.email, "admin");
    await admin.reload(); await admin.goto("/admin");
    await expect(admin.locator(".admin-stats .card")).toHaveCount(4);
    const row = admin.getByRole("row").filter({ hasText: account.email });
    await expect(async () => {
      if (!(await row.count())) await admin.getByRole("button", { name: "Actualizar", exact: true }).click();
      await expect(row).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 75000, intervals: [2000, 5000, 10000] });
    await row.getByRole("link", { name: "Ver actividad" }).click();
    await expect(admin.locator(".admin-activity")).toContainText("LOGIN");
    await admin.getByRole("button", { name: "Cerrar sesión", exact: true }).click(); await expect(admin).toHaveURL(/\/login$/);
  } finally { await adminContext.close(); }
});
