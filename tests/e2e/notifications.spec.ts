import { test, expect, type Page } from "@playwright/test";
import { initializeApp, getApps, getFirestore, Timestamp } from "../../Backend/tests/support/notifications";
import { readTestState, cleanupTestAccount } from "../../Backend/scripts/test-support";

test.skip(process.env.VC_E2E_REAL === "true", "Esta prueba solo usa cuentas y tokens del emulador.");
const created: { uid: string; email: string }[] = [];
function db() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") throw Error("Requiere emulador explícito");
  const app = getApps().find(app => app.name === "notification-e2e") || initializeApp({ projectId: "demo-visual-community" }, "notification-e2e");
  return getFirestore(app);
}
test.afterEach(async () => {
  for (const account of created.splice(0)) {
    await db().doc("userActivity/" + account.uid).delete();
    const audit = await db().collection("notificationAudit").where("userId", "==", account.uid).get();
    for (const doc of audit.docs) await doc.ref.delete();
    const tokens = await db().collection("unsubscribeTokens").where("userId", "==", account.uid).get();
    for (const doc of tokens.docs) await doc.ref.delete();
    await cleanupTestAccount(account.uid, account.email);
  }
});
async function register(page: Page) {
  await page.route("**/api/energy/**", route => route.fulfill({ status: 503, json: { message: "Proveedor omitido en la prueba de notificaciones." } }));
  await page.route("**/api/discovery/recommendations", route => route.fulfill({ status: 503, json: { message: "Proveedor omitido en la prueba de notificaciones." } }));
  const email = `vc-${Date.now()}-${Math.random().toString(36).slice(2)}@example.invalid`;
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill("Participante notificaciones");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("PruebaLocal2026!");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("PruebaLocal2026!");
  await page.getByRole("checkbox").check();
  const request = page.waitForResponse(response => response.url().includes("accounts:signUp") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  const account = { uid: (await (await request).json()).localId as string, email }; created.push(account);
  await expect(page).toHaveURL(/\/bienvenida$/); return account;
}
test("notificaciones: consentimiento opcional, perfil, retorno y baja pública confirmada", async ({ page }, info) => {
  const account = await register(page);
  const optIn = page.getByRole("checkbox", { name: /Recibir recordatorios por correo/ });
  await expect(optIn).not.toBeChecked();
  expect((await readTestState(account.uid, account.email)).profile?.emailNotifications.enabled).toBe(false);
  await optIn.check(); await page.getByRole("checkbox", { name: "Comunidades energéticas", exact: true }).check();
  await page.getByRole("button", { name: "Guardar y continuar" }).click(); await expect(page).toHaveURL(/\/$/);
  await page.goto("/perfil");
  const preference = page.getByRole("checkbox", { name: /Quiero recibir recordatorios/ }); await expect(preference).toBeChecked();
  await preference.uncheck();
  await expect(page.getByText("Desactivaste los recordatorios por correo.", { exact: true })).toBeVisible();
  await preference.check(); await expect(page.getByText("Activaste los recordatorios por correo.", { exact: true })).toBeVisible();
  await expect.poll(async () => (await db().doc("userActivity/" + account.uid).get()).exists).toBe(true);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  await page.goto("/buscar?category=regulation"); await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Correo electrónico", { exact: true }).fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("PruebaLocal2026!");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click(); await expect(page).toHaveURL(/\/buscar\?category=regulation$/);
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  const token = "fixture-" + "z".repeat(43); const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const key = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
  await db().doc("unsubscribeTokens/" + key).set({ userId: account.uid, reminderId: "fixture", expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000), usedAt: null });
  let posts = 0; page.on("request", request => { if (request.url().includes("/notifications/unsubscribe") && request.method() === "POST") posts++; });
  await page.goto("/notificaciones/baja#t=" + token);
  await expect(page.getByRole("heading", { name: "¿Quieres dejar de recibir recordatorios?" })).toBeVisible();
  expect(posts).toBe(0); expect((await readTestState(account.uid, account.email)).profile?.emailNotifications.enabled).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/notifications-unsubscribe-${info.project.name}.png` });
  await page.getByRole("button", { name: "Sí, dejar de recibir recordatorios" }).click();
  await expect(page.getByRole("heading", { name: "Recordatorios desactivados" })).toBeVisible(); expect(posts).toBe(1);
  expect((await readTestState(account.uid, account.email)).profile?.emailNotifications.enabled).toBe(false);
});
test("notificaciones: rechazar no bloquea la encuesta y un fallo revierte el control de perfil", async ({ page }) => {
  const account = await register(page);
  await page.getByRole("checkbox", { name: "Comunidades energéticas", exact: true }).check();
  await page.getByRole("button", { name: "Guardar y continuar" }).click(); await expect(page).toHaveURL(/\/$/);
  await page.goto("/perfil"); const preference = page.getByRole("checkbox", { name: /Quiero recibir recordatorios/ }); await expect(preference).not.toBeChecked();
  // Retenemos la respuesta para verificar el estado pendiente antes del rollback.
  // Sin esta sincronización, check() puede observar el control ya revertido por el 503.
  let releaseFailure = () => {};
  const failureGate = new Promise<void>(resolve => { releaseFailure = resolve; });
  await page.route("**/api/notifications/consent", async route => {
    await failureGate;
    await route.fulfill({ status: 503, json: { message: "Indisponible en la prueba" } });
  });
  const requestPromise = page.waitForRequest(request => request.url().endsWith("/api/notifications/consent") && request.method() === "POST");
  try {
    await preference.check();
    const request = await requestPromise;
    expect(request.postDataJSON()).toEqual({ enabled: true, origin: "profile" });
    await expect(preference).toBeChecked();
    await expect(preference).toBeDisabled();
    expect((await readTestState(account.uid, account.email)).profile?.emailNotifications.enabled).toBe(false);
    const responsePromise = page.waitForResponse(response => response.request() === request);
    releaseFailure();
    expect((await responsePromise).status()).toBe(503);
    await expect(page.getByRole("alert")).toContainText("No pudimos actualizar tus recordatorios");
    await expect(preference).not.toBeChecked();
    await expect(preference).toBeEnabled();
  } finally { releaseFailure(); }
  expect((await readTestState(account.uid, account.email)).profile?.emailNotifications.enabled).toBe(false);
});
