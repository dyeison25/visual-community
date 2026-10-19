import { cleanupTestAccount, readTestState, setTestRole } from "../../Backend/scripts/test-support";
import { test, expect, type Page } from "@playwright/test";
import { MINISTRY_COMMUNITIES_PAGE } from "../../shared/officialSources";
const real = process.env.VC_E2E_REAL === "true";
type Account = { uid: string; email: string };
const created: Account[] = [];
const password = "PruebaLocal2026!";
const unique = () => "vc-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "@example.invalid";
test.afterEach(async () => { for (const account of created.splice(0)) await cleanupTestAccount(account.uid, account.email); });
async function register(page: Page, complete = true): Promise<Account> {
  const email = unique();
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill("Comunidad de prueba");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  const signedUp = page.waitForResponse(response => response.url().includes("accounts:signUp") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  const response = await signedUp; expect(response.ok()).toBe(true);
  const body = await response.json();
  const account = { uid: body.localId, email }; created.push(account);
  await expect(page).toHaveURL(/\/bienvenida$/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "La energía que te interesa." })).toBeVisible();
  if (complete) await completeSurvey(page);
  return account;
}
async function completeSurvey(page: Page) {
  await page.getByRole("checkbox", { name: "Comunidades energéticas", exact: true }).check();
  await page.getByRole("checkbox", { name: "Energías renovables", exact: true }).check();
  await page.getByRole("checkbox", { name: "Contenido educativo", exact: true }).check();
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(page.getByRole("heading", { name: /Hola, Comunidad/ })).toBeVisible({ timeout: 25000 });
}
async function navigate(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Abrir menú" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation").getByRole("link", { name, exact: true }).click();
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(page.getByRole("button", { name: "Iniciar sesión", exact: true })).toBeVisible();
}
async function login(page: Page, email: string) {
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
}
async function statusFor(page: Page, path: string) {
  return page.evaluate(async path => {
    const { auth } = await import("/src/config/firebase.ts");
    return (await fetch(path, { headers: { Authorization: "Bearer " + await auth.currentUser.getIdToken() } })).status;
  }, path);
}
function eventTypes(state: Awaited<ReturnType<typeof readTestState>>) { return state.events.map(event => event.eventType); }

test("rutas privadas y formulario con correo inválido", async ({ page }) => {
  for (const path of ["/perfil", "/admin", "/admin/usuarios/cuenta-ajena", "/bienvenida"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/login$/);
  }
  await page.goto("/registro");
  await page.getByLabel("Correo electrónico", { exact: true }).fill("correo-invalido");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByRole("alert")).toContainText("correo electrónico válido");
});
test("Firebase crea la cuenta, exige encuesta, guarda preferencias y conserva sesión", async ({ page }, info) => {
  const account = await register(page, false);
  const initial = await readTestState(account.uid, account.email);
  expect(initial.profile?.role).toBe("user"); expect(initial.profile?.onboardingCompleted).toBe(false);
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(page.getByRole("alert")).toContainText("Selecciona al menos un tema");
  await page.goto("/datos"); await expect(page).toHaveURL(/\/bienvenida$/);
  await page.reload(); await expect(page).toHaveURL(/\/bienvenida$/);
  await expect(page.getByRole("heading", { name: "La energía que te interesa." })).toBeVisible();
  await page.screenshot({ path: "artifacts/onboarding-" + info.project.name + ".png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await completeSurvey(page);
  const complete = await readTestState(account.uid, account.email);
  expect(complete.profile?.onboardingCompleted).toBe(true);
  expect(complete.profile?.preferences.topics).toEqual(["energy_communities", "renewable_energy"]);
  expect(complete.profile?.preferences.formats).toEqual(["education"]);
  expect(eventTypes(complete)).toContain("COMPLETE_ONBOARDING");
  await page.reload(); await expect(page.getByRole("heading", { name: /Hola, Comunidad/ })).toBeVisible();
  await page.goto("/bienvenida"); await expect(page).toHaveURL(/\/$/);
  await logout(page); await page.goto("/datos");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("Incorrecta123!");
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("no son correctos");
  await login(page, account.email);
  await expect(page.getByRole("heading", { name: "La energía, en datos." })).toBeVisible();
  expect(eventTypes(await readTestState(account.uid, account.email)).filter(type => type === "COMPLETE_ONBOARDING")).toHaveLength(1);
  await logout(page);
  await page.goto("/registro");
  await page.getByLabel("Nombre", { exact: true }).fill("Duplicada");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(account.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar contraseña", { exact: true }).fill(password);
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByRole("alert")).toContainText("ya tiene una cuenta");
});
test("Mi perfil edita preferencias sin métricas y rechaza acceso administrativo", async ({ page }, info) => {
  const account = await register(page); await navigate(page, "Mi perfil");
  await expect(page.locator(".activity-stats")).toHaveCount(0);
  await expect(page.locator(".activity-list")).toHaveCount(0);
  await expect(page.getByText("Inicios de sesión", { exact: true })).toHaveCount(0);
  await page.getByLabel("Nombre", { exact: true }).fill("Perfil actualizado");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByText("Tu perfil se guardó correctamente.")).toBeVisible();
  await page.getByRole("button", { name: "Editar mis preferencias" }).click();
  await page.getByRole("checkbox", { name: "Normativa y regulación energética", exact: true }).check();
  await page.getByRole("button", { name: "Guardar preferencias", exact: true }).click();
  await expect(page.getByText("Tus preferencias se actualizaron correctamente.")).toBeVisible();
  await page.reload(); await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Perfil actualizado");
  await expect(page.getByText("Normativa y regulación energética", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/profile-" + info.project.name + ".png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const state = await readTestState(account.uid, account.email);
  expect(state.profile?.preferences.topics).toContain("regulation"); expect(eventTypes(state)).toContain("SELECT_PREFERENCES");
  expect(eventTypes(state)).toContain("UPDATE_PROFILE");
  await page.goto("/admin"); await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("La sección Administración requiere permisos de administrador.")).toBeVisible();
  for (const path of ["/api/admin/summary", "/api/admin/users", "/api/admin/users/" + account.uid, "/api/profile/metrics"])
    expect(await statusFor(page, path)).toBe(403);
  const denied = await page.evaluate(async () => {
    const { auth, db, usingEmulators } = await import("/src/config/firebase.ts");
    const host = usingEmulators ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com";
    const url = host + "/v1/projects/" + db.app.options.projectId + "/databases/(default)/documents/profiles/" + auth.currentUser.uid;
    const headers = { Authorization: "Bearer " + await auth.currentUser.getIdToken(), "Content-Type": "application/json" };
    const role = await fetch(url + "?updateMask.fieldPaths=role", { method: "PATCH", headers, body: JSON.stringify({ fields: { role: { stringValue: "admin" } } }) });
    const interactions = await fetch(url + "/interactions", { headers });
    return { role: role.status, interactions: interactions.status };
  });
  expect(denied).toEqual({ role: 403, interactions: 403 });
});
test("las fuentes reales conservan eventos y el enlace de comunidad abre una página pública", async ({ page }, info) => {
  const account = await register(page);
  await page.locator(".dashboard-lower").getByRole("button", { name: "¿Qué son las comunidades energéticas?", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible(); await page.getByRole("button", { name: "Cerrar detalle" }).click();
  await navigate(page, "Normativa");
  await page.getByRole("button", { name: "Resolución CREG 101 072 de 2025", exact: true }).click();
  const regulationPopup = page.waitForEvent("popup");
  await page.getByRole("dialog").getByRole("link", { name: "Abrir recurso oficial" }).click(); await (await regulationPopup).close();
  await page.getByRole("button", { name: "Cerrar detalle" }).click();
  await navigate(page, "Datos del sector");
  await expect(page.getByRole("button", { name: "Ver Generación real", exact: true })).toBeVisible({ timeout: 35000 });
  await expect(page.locator(".metric-value").first()).not.toContainText("Sin datos");
  await page.getByText("Ver valores de la serie", { exact: true }).click(); await expect(page.locator("tbody tr").first()).toBeVisible();
  await navigate(page, "Comunidades energéticas");
  await expect(page.locator(".community-card").first()).toBeVisible({ timeout: 35000 });
  await page.getByRole("button", { name: "Ver información", exact: true }).first().click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Municipio", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Departamento", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/community-detail-" + info.project.name + ".png", fullPage: true });
  const link = dialog.getByRole("link", { name: "Consultar fuente oficial" });
  await expect(link).toHaveAttribute("href", MINISTRY_COMMUNITIES_PAGE);
  const officialPopup = page.waitForEvent("popup"); await link.click(); const popup = await officialPopup;
  await expect(popup).toHaveURL(MINISTRY_COMMUNITIES_PAGE);
  expect(popup.url()).not.toContain("/query"); await popup.close();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Cerrar información de comunidad" }).click();
  await page.getByLabel("Buscar comunidades").fill("URIBIA"); await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.locator(".community-card").first()).toContainText("URIBIA", { timeout: 35000 });
  await expect.poll(async () => eventTypes(await readTestState(account.uid, account.email))).toEqual(expect.arrayContaining([
    "REGISTER", "COMPLETE_ONBOARDING", "VIEW_DASHBOARD", "VIEW_ARTICLE", "VIEW_REGULATION", "VIEW_METRIC", "VIEW_ENERGY_COMMUNITY", "CLICK_EXTERNAL_SOURCE",
  ]));
});
test("un fallo externo no bloquea las demás secciones", async ({ page }) => {
  await page.route("**/api/energy/metrics", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Fallo simulado únicamente por la prueba" }) }));
  await register(page); await expect(page.getByRole("alert")).toContainText("No pudimos cargar");
  await navigate(page, "Normativa"); await expect(page.getByRole("button", { name: "Resolución CREG 101 072 de 2025", exact: true })).toBeVisible();
  await navigate(page, "Mi perfil"); await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeVisible();
});
test("administrador consulta resumen, usuarios e historial y pierde acceso al revocar su rol", async ({ page, browser }, info) => {
  test.setTimeout(150000);
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const target = await register(page);
  const context = await browser.newContext({ baseURL: real ? "http://127.0.0.1:5173" : "http://127.0.0.1:5174", viewport: info.project.use.viewport });
  try {
    const adminPage = await context.newPage();
    const administrator = await register(adminPage);
    await setTestRole(administrator.uid, administrator.email, "admin");
    await logout(adminPage); await login(adminPage, administrator.email);
    await expect(adminPage.getByRole("heading", { name: /Hola, Comunidad/ })).toBeVisible();
    await navigate(adminPage, "Administración"); await expect(adminPage).toHaveURL(/\/admin$/);
    await expect(adminPage.locator(".admin-stats .card")).toHaveCount(4, { timeout: 35000 });
    expect(await statusFor(adminPage, "/api/admin/summary")).toBe(200);
    await expect(adminPage.getByRole("button", { name: "Cerrar sesión", exact: true })).toBeInViewport();
    expect(await statusFor(adminPage, "/api/admin/users/" + administrator.uid)).toBe(404);
    const summary = await adminPage.evaluate(async () => {
      const { auth } = await import("/src/config/firebase.ts");
      return (await (await fetch("/api/admin/summary", { headers: { Authorization: "Bearer " + await auth.currentUser.getIdToken() } })).json()).data;
    });
    expect(summary.recent.every((event: { userId: string }) => event.userId !== administrator.uid)).toBe(true);
    await expect(adminPage.getByRole("row").filter({ hasText: administrator.email })).toHaveCount(0);
    expect(eventTypes(await readTestState(administrator.uid, administrator.email))).toContain("LOGIN");
    const targetRow = adminPage.getByRole("row").filter({ hasText: target.email });
    await expect(async () => {
      if (!(await targetRow.count())) { await adminPage.getByRole("button", { name: "Actualizar", exact: true }).click(); }
      await expect(targetRow).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 75000, intervals: [2000, 5000, 10000] });
    await adminPage.screenshot({ path: "artifacts/admin-" + info.project.name + ".png", fullPage: true });
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await targetRow.getByRole("link", { name: "Ver actividad" }).click();
    await expect(adminPage.getByRole("heading", { name: "Detalle de usuario" })).toBeVisible();
    await expect(adminPage.locator(".admin-activity")).toContainText("COMPLETE_ONBOARDING");
    await expect(adminPage.locator(".admin-activity")).toContainText("REGISTER");
    await expect(adminPage.locator(".activity-stats .card")).toHaveCount(3);
    await adminPage.screenshot({ path: "artifacts/admin-user-" + info.project.name + ".png", fullPage: true });
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await logout(adminPage);
    expect(eventTypes(await readTestState(administrator.uid, administrator.email))).toContain("LOGOUT");
    await login(adminPage, administrator.email);
    // El login puede volver al detalle protegido desde el que se cerró sesión.
    await expect(adminPage.locator(".topbar").getByRole("button", { name: "Cerrar sesión", exact: true })).toBeVisible({ timeout: 30000 });
    await navigate(adminPage, "Administración");
    await setTestRole(administrator.uid, administrator.email, "user");
    await expect(adminPage).toHaveURL(/\/$/);
    expect(await statusFor(adminPage, "/api/admin/summary")).toBe(403);
    await expect(adminPage.getByRole("navigation").getByRole("link", { name: "Administración", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
test("dos cuentas mantienen sus perfiles privados", async ({ page, browser }) => {
  const first = await register(page);
  const context = await browser.newContext({ baseURL: real ? "http://127.0.0.1:5173" : "http://127.0.0.1:5174" });
  try {
    const other = await context.newPage(); await register(other);
    const statuses = await other.evaluate(async foreignUid => {
      const { auth, db, usingEmulators } = await import("/src/config/firebase.ts");
      const host = usingEmulators ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com";
      const base = host + "/v1/projects/" + db.app.options.projectId + "/databases/(default)/documents/profiles/";
      const headers = { Authorization: "Bearer " + await auth.currentUser.getIdToken() };
      return { own: (await fetch(base + auth.currentUser.uid, { headers })).status,
        foreign: (await fetch(base + foreignUid, { headers })).status, anonymous: (await fetch(base + auth.currentUser.uid)).status };
    }, first.uid);
    expect(statuses.own).toBe(200); expect(statuses.foreign).toBe(403); expect([401, 403]).toContain(statuses.anonymous);
  } finally { await context.close(); }
});

test("una escritura sin conexión no confirma la encuesta de forma anticipada", async ({ page, context }) => {
  await register(page, false);
  await page.getByRole("checkbox", { name: "Comunidades energéticas", exact: true }).check();
  try {
    await context.setOffline(true);
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(page.getByRole("alert")).toContainText("No pudimos confirmar tus preferencias", { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "La energía que te interesa." })).toBeVisible();
    await expect(page).toHaveURL(/\/bienvenida$/);
  } finally { await context.setOffline(false); }
  // Firebase puede terminar la escritura pendiente al recuperar conexión.
  await expect(page.getByRole("heading", { name: /Hola, Comunidad/ })).toBeVisible({ timeout: 30000 });
});

test("descubrimiento: mapa real, recomendaciones y fallos de configuración simulados",async({page},info)=>{
  test.setTimeout(120000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const mapResponse=page.waitForResponse(response=>response.url().includes("/api/energy/map")&&response.request().method()==="GET");
  const account=await register(page);
  await expect(page.getByRole("heading",{name:"Recomendado para ti",exact:true})).toBeVisible();
  await expect(page.locator(".discovery-card").first()).toBeVisible({timeout:35000});
  const result=await (await mapResponse).json();
  expect(result.status).toBe("ok");expect(result.data.length).toBeGreaterThan(0);
  const row=result.data.find((c:any)=>c.latitude!==null&&c.longitude!==null&&c.latitude>=0&&c.latitude<12&&c.longitude>-78&&c.longitude<-69);
  expect(row).toBeTruthy();
  const map=page.locator(".energy-map");await map.scrollIntoViewIfNeeded();await expect(map.locator("canvas")).toBeVisible();
  const project=(lat:number,lng:number)=>{const sin=Math.sin(lat*Math.PI/180);return {x:(lng+180)/360*8192,y:(0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*8192};};
  const center=project(4.5,-73.5),point=project(row.latitude,row.longitude);
  const bounds=await map.boundingBox();
  await map.click({position:{x:bounds!.width/2+point.x-center.x,y:bounds!.height/2+point.y-center.y}});
  const popup=map.locator(".leaflet-popup-content");await expect(popup).toBeVisible();
  await expect(popup).toContainText("Ministerio de Minas y Energía");
  await popup.getByRole("button",{name:"Ver información",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("link",{name:"Consultar fuente oficial"})).toHaveAttribute("href",MINISTRY_COMMUNITIES_PAGE);
  await page.getByRole("button",{name:"Cerrar información de comunidad"}).click();
  await page.screenshot({path:"artifacts/discovery-map-"+info.project.name+".png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  // Este escenario valida degradación, independientemente de las claves locales activas.
  await page.route("**/api/discovery/search?**",route=>route.fulfill({status:503,json:{message:"La búsqueda todavía no está configurada. Puedes consultar las secciones de la plataforma."}}));
  await page.getByRole("link",{name:"Buscar en la plataforma"}).click();
  await page.getByLabel("¿Qué quieres consultar?").fill("solar");
  await page.getByRole("button",{name:"Buscar",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("no está configurada");
  await page.route("**/api/chat",route=>route.fulfill({status:503,json:{message:"El asistente todavía no está configurado. Puedes consultar las fuentes en la plataforma."}}));
  await page.getByRole("button",{name:"Abrir asistente"}).click();
  await page.getByLabel("Tu pregunta").fill("¿Qué es una comunidad energética?");
  await page.getByRole("button",{name:"Enviar",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("no está configurado");
  await page.screenshot({path:"artifacts/discovery-chat-"+info.project.name+".png",fullPage:true});
  await page.getByRole("button",{name:"Cerrar asistente"}).click();
  await expect.poll(async()=>eventTypes(await readTestState(account.uid,account.email))).toEqual(expect.arrayContaining(["VIEW_ENERGY_MAP","CLICK_ENERGY_COMMUNITY_MARKER","VIEW_ENERGY_COMMUNITY","SEARCH","CHAT_OPEN","CHAT_QUERY"]));
  expect(errors).toEqual([]);
});
test("descubrimiento: contrato de búsqueda y conversación con respuestas simuladas solo en la prueba",async({page})=>{
  const account=await register(page);
  const article={id:"min-comunidades",title:"¿Qué son las comunidades energéticas?",description:"Conoce la estrategia del Ministerio.",date:null,source:"MinEnergía",sourceUrl:MINISTRY_COMMUNITIES_PAGE,type:"Información",topics:["Comunidades energéticas"]};
  const hit={objectID:"article:"+article.id,contentId:article.id,title:article.title,description:article.description,kind:"article",category:"energy_communities",topics:["energy_communities"],source:article.source,sourceUrl:article.sourceUrl,publishedAt:null,indexedAt:new Date().toISOString(),keywords:[],article};
  await page.route("**/api/discovery/search?**",route=>route.fulfill({json:{hits:[hit],total:1,page:0,pages:1,provider:"algolia"}}));
  await page.getByRole("link",{name:"Buscar en la plataforma"}).click();
  await page.getByLabel("¿Qué quieres consultar?").fill("comunidades");
  await page.getByRole("button",{name:"Buscar",exact:true}).click();
  await page.locator(".discovery-card").getByRole("button",{name:article.title}).click();
  await expect(page.getByRole("dialog").getByRole("heading",{name:article.title})).toBeVisible();
  await page.getByRole("button",{name:"Cerrar detalle"}).click();
  const requests:any[]=[];
  await page.route("**/api/chat",async route=>{requests.push(route.request().postDataJSON());await route.fulfill({json:{answer:"Respuesta simulada de la prueba [1]",sources:[hit],category:"energy_communities"}});});
  await page.getByRole("button",{name:"Abrir asistente"}).click();
  await page.getByLabel("Tu pregunta").fill("Comunidades en Antioquia");
  await page.getByRole("button",{name:"Enviar",exact:true}).click();
  await expect(page.locator(".chat-message.assistant")).toHaveCount(1);
  await page.getByLabel("Tu pregunta").fill("¿Y en Medellín?");
  await page.getByRole("button",{name:"Enviar",exact:true}).click();
  await expect(page.locator(".chat-message.assistant")).toHaveCount(2);
  expect(requests[1].history).toHaveLength(2);expect(requests[1].history[0].content).toBe("Comunidades en Antioquia");
  const link=page.locator(".chat-sources a").first();await expect(link).toHaveAttribute("href",article.sourceUrl);
  const popupEvent=page.waitForEvent("popup");await link.click();const sourcePage=await popupEvent;await expect(sourcePage).toHaveURL(MINISTRY_COMMUNITIES_PAGE);await sourcePage.close();
  await expect.poll(async()=>eventTypes(await readTestState(account.uid,account.email))).toEqual(expect.arrayContaining(["SEARCH_RESULT_CLICK","CHAT_RESPONSE","CHAT_SOURCE_CLICK"]));
});

test("cinco comunidades conservan detalle y abren una fuente oficial sin 404 ni JSON",async({page})=>{
 test.setTimeout(180000);
 const account=await register(page);
 await navigate(page,"Comunidades energéticas");
 await expect(page.locator(".community-card").first()).toBeVisible({timeout:35000});
 const checks:{name:string;url:string;browserBlocked:boolean;contentVisible:boolean}[]=[];
 for(let index=0;index<5;index++){
  const card=page.locator(".community-card").nth(index);
  const name=await card.locator("h3").innerText();
  await card.getByRole("button",{name:"Ver información",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await expect(dialog).toContainText(name);
  await expect(dialog.getByText("Municipio",{exact:true})).toBeVisible();
  const link=dialog.getByRole("link",{name:"Consultar fuente oficial"});
  await expect(link).toHaveAttribute("href",MINISTRY_COMMUNITIES_PAGE);
  const event=page.waitForEvent("popup");await link.click();const source=await event;
  await expect(source).toHaveURL(MINISTRY_COMMUNITIES_PAGE);
  await source.waitForLoadState("domcontentloaded");
  expect(source.url()).not.toMatch(/MapServer|FeatureServer|\/query|\.json/i);
  const body=await source.locator("body").innerText();
  checks.push({name,url:source.url(),browserBlocked:/url bloqueada|pagina web bloqueda|han bloqueado/i.test(body),contentVisible:/hace el lanzamiento de Comunidades Energéticas/i.test(body)&&!/no encontramos el contenido/i.test(body)});
  await source.close();
  await page.getByRole("button",{name:"Cerrar información de comunidad"}).click();
 }
 await expect.poll(async()=>new Set((await readTestState(account.uid,account.email)).events.filter(e=>e.eventType==="CLICK_EXTERNAL_SOURCE"&&e.source==="MinEnergía").map(e=>e.contentId)).size).toBe(5);
 await test.info().attach("minenergia-five-links",{body:JSON.stringify(checks,null,2),contentType:"application/json"});
 expect(checks.filter(check=>!check.contentVisible),"El Ministerio debe permitir consultar la página desde el navegador; los bloqueos externos se documentan, no se ocultan.").toEqual([]);
});

test("chat real sin contexto devuelve mensaje honesto y registra los eventos",async({page})=>{
 test.skip(process.env.VC_E2E_CHAT_CONFIGURED!=="true","Activar solo con GEMINI_API_KEY y GEMINI_MODEL configurados; esta pregunta sin fuentes no llama al proveedor.");
 const account=await register(page);
 await page.getByRole("button",{name:"Abrir asistente"}).click();
 await page.getByLabel("Tu pregunta").fill("¿Qué comunidades hay en Marte?");
 await page.getByRole("button",{name:"Enviar",exact:true}).click();
 await expect(page.locator(".chat-message.assistant")).toContainText("No encontré información suficiente en las fuentes disponibles para responder con precisión.",{timeout:65000});
 await expect(page.getByLabel("Tu pregunta")).toBeEnabled();
 await expect(page.locator(".chat-sources")).toHaveCount(0);
 await expect.poll(async()=>eventTypes(await readTestState(account.uid,account.email))).toEqual(expect.arrayContaining(["CHAT_OPEN","CHAT_QUERY","CHAT_RESPONSE"]));
 await page.getByRole("button",{name:"Cerrar asistente"}).click();
});

test("Gemini sin clave: interfaz con error simulado conserva navegación y eventos",async({page})=>{
 const account=await register(page);
 await page.route("**/api/chat",route=>route.fulfill({status:503,json:{message:"El asistente todavía no está configurado. Puedes consultar las fuentes en la plataforma."}}));
 await page.getByRole("button",{name:"Abrir asistente"}).click();
 const dialog=page.getByRole("dialog");
 await expect(dialog).toContainText("Google Gemini");
 await page.getByLabel("Tu pregunta").fill("¿Qué es una comunidad energética?");
 const responsePromise=page.waitForResponse(r=>r.url().endsWith("/api/chat")&&r.request().method()==="POST");
 await page.getByRole("button",{name:"Enviar",exact:true}).click();
 const response=await responsePromise;
 expect(response.status()).toBe(503);
 const body=await response.text();
 expect(body).not.toContain("GEMINI_API_KEY");expect(body).not.toContain("stack");
 await expect(dialog.getByRole("alert")).toContainText("no está configurado");
 await expect(page.getByRole("button",{name:"Enviar",exact:true})).toBeEnabled();
 const bounds=await dialog.boundingBox(),viewport=page.viewportSize()!;
 expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
 expect(bounds!.height).toBeLessThanOrEqual(viewport.height);
 await page.getByRole("button",{name:"Cerrar asistente"}).click();
 await navigate(page,"Mi perfil");
 await expect(page.getByRole("button",{name:"Guardar cambios",exact:true})).toBeVisible();
 await expect.poll(async()=>eventTypes(await readTestState(account.uid,account.email))).toEqual(expect.arrayContaining(["CHAT_OPEN","CHAT_QUERY"]));
});
