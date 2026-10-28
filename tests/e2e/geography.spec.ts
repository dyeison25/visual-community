import { test, expect, type Page, type Route } from "@playwright/test";
import { cleanupTestAccount } from "../../Backend/scripts/test-support";
import { initializeApp, getApps, getFirestore } from "../../Backend/tests/support/notifications";
import { mapIntent } from "../../Backend/src/services/geography/intent";
import { publicLayer } from "../../Backend/src/services/geography/catalog";
import type { MapContext, MapData, MapLayerId } from "../../shared/geography";

test.skip(process.env.VC_E2E_REAL === "true", "Esta suite solo permite cuentas del emulador.");
const accounts: { uid: string; email: string }[] = [];
test.afterEach(async () => {
  if (!accounts.length) return;
  if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") throw Error("Solo emuladores");
  const app = getApps().find(app => app.name === "geography-e2e") || initializeApp({ projectId: "demo-visual-community" }, "geography-e2e");
  for (const account of accounts.splice(0)) { await getFirestore(app).doc("userActivity/" + account.uid).delete(); await cleanupTestAccount(account.uid, account.email); }
});
async function signIn(page: Page) {
  await page.route("**/api/energy/**", route => route.fulfill({ status: 503, json: { message: "Fuente omitida únicamente en esta prueba." } }));
  await page.route("**/api/discovery/recommendations", route => route.fulfill({ status: 503, json: { message: "Recomendaciones omitidas únicamente en esta prueba." } }));
  const email = "vc-geo-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "@example.invalid";
  await page.goto("/registro"); await page.getByLabel("Nombre", { exact: true }).fill("Prueba geográfica");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email); await page.getByLabel("Contraseña", { exact: true }).fill("PruebaLocal2026!");
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill("PruebaLocal2026!"); await page.getByRole("checkbox").check();
  const request = page.waitForResponse(response => response.url().includes("accounts:signUp") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click(); accounts.push({ uid: (await (await request).json()).localId, email });
  await expect(page).toHaveURL(/\/bienvenida$/); await page.getByRole("checkbox", { name: "Comunidades energéticas", exact: true }).check();
  await page.getByRole("button", { name: "Guardar y continuar" }).click(); await expect(page).toHaveURL(/\/$/);
}
async function searchFixture(page: Page) {
  const calls: string[] = [];
  await page.route("**/api/discovery/search?**", route => {
    calls.push(route.request().url()); return route.fulfill({ json: { hits: [{ objectID: "fixture-document", contentId: "fixture-document", title: "Documento sintético de la prueba", description: "Esta respuesta solo existe en la suite de interfaz.",
      kind: "article", category: "energy_communities", topics: ["energy_communities"], source: "MinEnergía", sourceUrl: "https://www.minenergia.gov.co/", publishedAt: null, indexedAt: "2026-10-28", keywords: [] }], total: 36, page: Number(new URL(route.request().url()).searchParams.get("page") || 0), pages: 3, provider: "algolia" } });
  }); return calls;
}
// Fixtures explícitas: no reemplazan ninguna fuente de producción.
function contextFixture(url: URL): MapContext {
  const p = url.searchParams, intent = mapIntent(p.get("q") || "", p.get("category") || "");
  const id = p.get("layer") as MapLayerId || (intent.candidates.length === 1 ? intent.candidates[0] : null);
  const place = p.get("department") === "44" ? { departmentCode: "44", department: "LA GUAJIRA" } : p.get("department") === "05" ? { departmentCode: "05", department: "ANTIOQUIA" } : p.get("department") === "13" ? { departmentCode: "13", department: "BOLÍVAR" } : null;
  return { status: !intent.candidates.length ? "none" : !id ? "choice" : "ready", message: intent.message,
    choices: intent.candidates.map(publicLayer), layer: id ? publicLayer(id) : null, place,
    placeChoices: [], bounds: place ? [-76, 5, -74, 7] : null,
    departments: [{ code: "05", name: "ANTIOQUIA" }, { code: "44", name: "LA GUAJIRA" }, { code: "13", name: "BOLÍVAR" }], municipalities: place?.departmentCode === "05" ? [{ code: "05001", name: "MEDELLÍN" }] : place?.departmentCode === "44" ? [{ code: "44847", name: "URIBIA" }] : place ? [{ code: "13683", name: "SANTA ROSA" }] : [],
    technologies: ["SOLAR", "HIDRAULICA"], technology: p.get("technology") || "", inferredTechnology: intent.technology,
    display: p.get("display") as "vector" | "wms" || (id && ["solar", "wind"].includes(id) && !place ? "wms" : "vector"), territorialMode: place ? "attributes" : "none", legend: [{ label: "Simbología sintética de la prueba", color: "#315c44" }], warnings: [] };
}
function dataFixture(url: URL): MapData {
  const id = url.searchParams.get("layer") as MapLayerId || "communities";
  const geometry = ["solar", "wind"].includes(id) ? { type: "Polygon" as const, coordinates: [[[-75, 6], [-74.99, 6], [-74.99, 6.01], [-75, 6]]] }
    : id === "transmission" ? { type: "LineString" as const, coordinates: [[-75, 6], [-74.99, 6]] } : { type: "Point" as const, coordinates: [-75, 6] };
  return { type: "FeatureCollection", features: [{ type: "Feature", id: id + ":fixture", geometry: geometry as MapData["features"][number]["geometry"], properties: {
    title: "Elemento sintético " + id, color: "#315c44", facts: [{ label: "Información", value: "Dato exclusivo de la prueba de interfaz" }] } }], truncated: false, discarded: 0, limit: 250, fetchedAt: new Date().toISOString(), bounds: null, territorialMode: "none" };
}
async function geographicFixtures(page: Page, hook?: (route: Route) => Promise<boolean>) {
  const requests: URL[] = [];
  await page.route("**/api/geography/**", async route => {
    const url = new URL(route.request().url()); requests.push(url);
    if (hook && await hook(route)) return;
    if (url.pathname.endsWith("/context")) await route.fulfill({ json: contextFixture(url) });
    else if (url.pathname.endsWith("/features")) await route.fulfill({ json: dataFixture(url) });
    else await route.fulfill({ contentType: "image/png", headers: { "X-Map-Bounds": url.searchParams.get("bbox")! }, body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=", "base64") });
  }); return requests;
}

test("mapas contextuales: siete capas, geometrías, detalles y filtros independientes de Algolia", async ({ page }, info) => {
  const searches = await searchFixture(page); const requests = await geographicFixtures(page); await signIn(page);
  for (const [q, id] of [["Comunidades energéticas", "communities"], ["Proyectos de generación", "generation"], ["Subestaciones", "substations"], ["Líneas de transmisión", "transmission"], ["Capacidad asignada", "connection"]]) {
    await page.goto("/buscar?" + new URLSearchParams({ q }));
    await expect(page.getByText("Documento sintético de la prueba", { exact: true })).toBeVisible();
    await expect(page.locator(".geo-records summary")).toContainText("(1)"); await page.locator(".geo-records summary").click();
    await page.getByRole("button", { name: "Elemento sintético " + id }).click();
    await expect(page.getByRole("dialog")).toContainText("Dato exclusivo de la prueba");
    await expect(page.getByRole("dialog").getByRole("link", { name: /geovisor oficial/ })).not.toHaveAttribute("href", /FeatureServer|MapServer|\.json/);
    await page.getByRole("button", { name: "Cerrar detalle geográfico" }).click();
  }
  for (const q of ["Radiación solar", "Potencial eólico"]) {
    await page.goto("/buscar?" + new URLSearchParams({ q })); await expect(page.locator(".geo-map .leaflet-image-layer")).toBeVisible();
    await page.getByLabel("Representación del mapa").selectOption("vector"); await expect(page.locator(".geo-records summary")).toContainText("(1)"); await expect(page.locator(".geo-map canvas").first()).toBeVisible();
    await expect(page.getByLabel("Leyenda del mapa")).toContainText("Simbología sintética");
  }
  await page.goto("/buscar?" + new URLSearchParams({ q: "Proyectos solares", category: "generation", page: "1" }));
  await expect(page.locator(".geo-records summary")).toBeVisible(); const before = searches.length;
  await page.getByLabel("Departamento del mapa").selectOption("05"); await expect(page.locator(".geo-records summary")).toBeVisible();
  await page.getByLabel("Tecnología del mapa").selectOption("HIDRAULICA"); await expect(page.locator(".geo-records summary")).toBeVisible();
  expect(searches.length).toBe(before); const params = new URL(page.url()).searchParams; expect(params.get("q")).toBe("Proyectos solares"); expect(params.get("page")).toBe("1"); expect(params.get("category")).toBe("generation");
  expect(requests.some(url => url.searchParams.get("technology") === "HIDRAULICA")).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/mapas-contextuales-fixtures-" + info.project.name + ".png", fullPage: true });
});
test("mapas contextuales: ambigüedad, ausencia y error no bloquean resultados", async ({ page }) => {
  await searchFixture(page); let unavailable = false; let malformed = false;
  await geographicFixtures(page, async route => {
    if (unavailable) { await route.fulfill({ status: 503, json: { message: "La fuente geográfica no está disponible temporalmente." } }); return true; }
    if (malformed) { await route.fulfill({ json: {} }); return true; }
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/context") && url.searchParams.get("q") === "Comunidades en Santa Rosa" && !url.searchParams.get("municipality")) {
      await route.fulfill({ json: { ...contextFixture(url), status: "place_choice", placeChoices: [{ departmentCode: "13", department: "BOLÍVAR", municipalityCode: "13683", municipality: "SANTA ROSA" }, { departmentCode: "19", department: "CAUCA", municipalityCode: "19701", municipality: "SANTA ROSA" }] } }); return true;
    } return false;
  }); await signIn(page);
  await page.goto("/buscar?q=Energ%C3%ADas%20renovables");
  await expect(page.getByLabel("Mapa relacionado")).toHaveValue(""); await expect(page.locator(".geo-map")).toHaveCount(0);
  await page.getByLabel("Mapa relacionado").selectOption("wind"); await expect(page.locator(".geo-map .leaflet-image-layer")).toBeVisible();
  await page.getByRole("button", { name: "Contraer mapa" }).click(); await expect(page.locator(".geo-map")).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar mapa" }).click(); await expect(page.locator(".geo-map")).toBeVisible();
  await page.goto("/buscar?" + new URLSearchParams({ q: "Comunidades en Santa Rosa" })); await expect(page.locator(".geo-map")).toHaveCount(0);
  await page.getByLabel("Territorio encontrado").selectOption("13:13683"); await expect(page.locator(".geo-records summary")).toBeVisible(); expect(new URL(page.url()).searchParams.get("mapMunicipality")).toBe("13683");
  await page.goto("/buscar?q=Normativa%20solar"); await expect(page.getByText("Documento sintético de la prueba", { exact: true })).toBeVisible(); await expect(page.getByRole("region", { name: "Mapa contextual de la búsqueda" })).toHaveCount(0);
  malformed = true; await page.goto("/buscar?q=Subestaciones"); await expect(page.getByRole("alert")).toContainText("formato"); await expect(page.getByText("Documento sintético de la prueba", { exact: true })).toBeVisible();
  malformed = false; unavailable = true; await page.goto("/buscar?q=Subestaciones"); await expect(page.getByRole("alert")).toContainText("geográfica"); await expect(page.getByText("Documento sintético de la prueba", { exact: true })).toBeVisible();
});
test("mapas contextuales: una respuesta anterior no restaura el mapa de otra búsqueda", async ({ page }) => {
  await searchFixture(page); let release!: () => void; let started!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; }); const start = new Promise<void>(resolve => { started = resolve; });
  await geographicFixtures(page, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/context") && url.searchParams.get("q") === "Comunidades energéticas") { started(); await hold; await route.fulfill({ json: contextFixture(url) }).catch(() => {}); return true; } return false;
  }); await signIn(page);
  await page.goto("/buscar?" + new URLSearchParams({ q: "Comunidades energéticas" })); await start;
  await page.getByLabel("¿Qué quieres consultar?").fill("Radiación solar"); await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Radiación solar", exact: true })).toBeVisible(); release();
  await expect(page.locator(".geo-map .leaflet-image-layer")).toBeVisible(); await expect(page.getByRole("heading", { name: "Comunidades energéticas postuladas" })).toHaveCount(0);
});
test("mapas contextuales oficiales: WMS real y generación filtrada en escritorio y móvil", async ({ page }, info) => {
  test.skip(process.env.VC_E2E_GEO_LIVE !== "true", "Habilitar explícitamente para las consultas oficiales acotadas; nunca usa usuarios reales.");
  test.setTimeout(180000); await searchFixture(page); await signIn(page);
  await page.goto("/buscar?" + new URLSearchParams({ q: "Radiación solar" }));
  await expect(page.locator(".geo-map .leaflet-image-layer")).toBeVisible({ timeout: 65000 });
  await expect(page.getByLabel("Leyenda del mapa")).toContainText("kWh/m²/día");
  await page.screenshot({ path: "artifacts/mapa-contextual-solar-oficial-" + info.project.name + ".png", fullPage: true });
  await page.goto("/buscar?" + new URLSearchParams({ q: "Proyectos solares en Antioquia" }));
  await expect(page.locator(".geo-records summary")).toBeVisible({ timeout: 65000 }); await page.locator(".geo-records summary").click(); await page.locator(".geo-records button").first().click();
  await expect(page.getByRole("dialog")).toContainText("SOLAR"); await page.getByRole("button", { name: "Cerrar detalle geográfico" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/mapa-contextual-generacion-oficial-" + info.project.name + ".png", fullPage: true });
});
