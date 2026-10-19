import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "node:fs";
const account = JSON.parse(readFileSync("./firebase-service-account.json", "utf8"));
const project = account.project_id;
const client = await new GoogleAuth({ keyFilename: "./firebase-service-account.json", scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getClient();
async function request(url: string, method: "GET" | "POST" = "GET", data?: unknown): Promise<any> {
  return (await client.request({ url, method, data, timeout: 25000 })).data;
}
try {
  const service = await request("https://serviceusage.googleapis.com/v1/projects/" + project + "/services/firestore.googleapis.com");
  if (service.state !== "ENABLED") {
    if (!process.argv.includes("--enable")) { console.log("Firestore API está deshabilitada."); process.exit(0); }
    let operation = await request("https://serviceusage.googleapis.com/v1/projects/" + project + "/services/firestore.googleapis.com:enable", "POST", {});
    for (let i = 0; !operation.done && i < 30; i++) { await Bun.sleep(1000); operation = await request("https://serviceusage.googleapis.com/v1/" + operation.name); }
    if (operation.error) throw new Error("No se pudo habilitar Firestore");
    console.log("Firestore API habilitada.");
  }
  const base = "https://firestore.googleapis.com/v1/projects/" + project + "/databases";
  const databases = await request(base);
  console.log(JSON.stringify({ databases: databases.databases?.map((item: any) => ({ name: item.name, location: item.locationId })) || [] }));
  if (!databases.databases?.some((item: any) => item.name.endsWith("/(default)"))) {
    console.log("No existe base predeterminada. Créala en Firebase Console (Firestore Native) antes de publicar reglas.");
  }
} catch (error: any) {
  console.log(JSON.stringify({ status: error.response?.status || "unavailable", reason: error.response?.data?.error?.details?.map((d: any) => d.reason).filter(Boolean) || [], message: "No se completó la preparación de Firestore; no se modificaron bases ni reglas." }));
  process.exitCode = 1;
}
