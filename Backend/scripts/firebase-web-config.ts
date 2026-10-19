import { GoogleAuth } from "google-auth-library";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const accountPath = resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || "firebase-service-account.json");
const account = JSON.parse(readFileSync(accountPath, "utf8"));
const project = account.project_id as string;
const auth = new GoogleAuth({ keyFilename: accountPath, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
async function request(path: string, method = "GET", data?: unknown) {
  return (await client.request<Record<string, any>>({ url: path, method: method as "GET" | "POST", data, timeout: 20000 })).data;
}
try {
  const base = "https://firebase.googleapis.com/v1beta1/projects/" + project + "/webApps";
  const listed = await request(base);
  let app = listed.apps?.find((item: any) => item.displayName === "Visual Community");
  if (!app && process.argv.includes("--create-web-app")) {
    let operation = await request(base, "POST", { displayName: "Visual Community" });
    for (let i = 0; !operation.done && i < 30; i++) {
      await Bun.sleep(1000);
      operation = await request("https://firebase.googleapis.com/v1beta1/" + operation.name);
    }
    if (operation.error || !operation.done) throw new Error("No se pudo registrar la app web");
    app = operation.response;
  }
  if (app) {
    const config = await request("https://firebase.googleapis.com/v1beta1/" + app.name + "/config");
    const path = resolve("../Frontend/.env");
    if (!existsSync(path)) {
      writeFileSync(path, ["VITE_FIREBASE_API_KEY=" + config.apiKey, "VITE_FIREBASE_AUTH_DOMAIN=" + config.authDomain,
        "VITE_FIREBASE_PROJECT_ID=" + config.projectId, "VITE_FIREBASE_APP_ID=" + config.appId,
        "VITE_API_BASE_URL=/api", "VITE_USE_FIREBASE_EMULATORS=false", ""].join("\n"));
      console.log("Configuración pública de la app web guardada en Frontend/.env (valores omitidos).");
    } else console.log("Frontend/.env ya existe: se conserva sin sobrescribir.");
  } else console.log("No existe una app web llamada Visual Community.");
  for (const [name, url] of [
    ["Authentication", "https://identitytoolkit.googleapis.com/admin/v2/projects/" + project + "/config"],
    ["Firestore", "https://firestore.googleapis.com/v1/projects/" + project + "/databases/(default)"],
  ]) {
    try {
      const result = await request(url);
      console.log(name === "Authentication" ? JSON.stringify({ service: name, emailPasswordEnabled: !!result.signIn?.email?.enabled, authorizedDomains: result.authorizedDomains }) : JSON.stringify({ service: name, available: true, location: result.locationId }));
    } catch (error: any) { console.log(JSON.stringify({ service: name, status: error.response?.status || "unavailable" })); }
  }
} catch (error: any) { console.error("No se completó la configuración Firebase. Estado:", error.response?.status || "unavailable"); process.exitCode = 1; }
