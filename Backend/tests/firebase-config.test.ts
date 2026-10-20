import { afterEach, beforeEach, expect, test } from "bun:test";
import { applicationDefault, deleteApp, getApp, getApps } from "firebase-admin/app";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { getFirebaseAuth } from "../src/config/firebase.config";

// Clave sintética efímera: no pertenece a Firebase y nunca sale de esta prueba.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const keys = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_AUTH_EMULATOR_HOST", "NODE_ENV"];
let previous: Record<string, string | undefined>;
let directory: string;
let previousDirectory: string;

beforeEach(() => {
  if (getApps().length) throw new Error("La prueba requiere una instancia Firebase aislada.");
  previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  previousDirectory = process.cwd();
  directory = mkdtempSync(resolve(tmpdir(), "vc-firebase-config-"));
  process.chdir(directory);
});
afterEach(async () => {
  for (const app of getApps()) await deleteApp(app);
  process.chdir(previousDirectory);
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
  if (dirname(directory) !== resolve(tmpdir()) || !directory.startsWith(resolve(tmpdir(), "vc-firebase-config-"))) {
    throw new Error("Ruta temporal inesperada.");
  }
  rmSync(directory, { recursive: true, force: true });
});
function accountFile(name: string, project = "fixture-local") {
  writeFileSync(resolve(directory, name), JSON.stringify({ project_id: project,
    client_email: "fixture@example.invalid", private_key: privateKey }));
}
function envAccount(escaped = true) {
  process.env.FIREBASE_PROJECT_ID = "fixture-env";
  process.env.FIREBASE_CLIENT_EMAIL = "fixture@example.invalid";
  process.env.FIREBASE_PRIVATE_KEY = escaped ? privateKey.replace(/\n/g, "\\n") : privateKey;
}

test("variables completas tienen prioridad sobre ambos archivos y normalizan saltos escapados", () => {
  envAccount();
  accountFile("explicit.json", "fixture-other");
  accountFile("firebase-service-account.json", "fixture-other");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(directory, "explicit.json");
  getFirebaseAuth();
  expect(getApp().options.projectId).toBe("fixture-env");
  expect(getApp().options.credential).not.toBe(applicationDefault());
});
test("acepta saltos reales y reutiliza la instancia ya inicializada", () => {
  envAccount(false);
  const auth = getFirebaseAuth();
  process.env.FIREBASE_PRIVATE_KEY = "invalid-fixture";
  expect(getFirebaseAuth()).toBe(auth);
  expect(getApps()).toHaveLength(1);
});
test("GOOGLE_APPLICATION_CREDENTIALS tiene prioridad sobre el archivo local", () => {
  accountFile("explicit.json", "fixture-explicit");
  accountFile("firebase-service-account.json");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(directory, "explicit.json");
  getFirebaseAuth();
  expect(getApp().options.projectId).toBe("fixture-explicit");
});
test("el flujo local funciona sin las variables nuevas y conserva la validación del proyecto", () => {
  accountFile("firebase-service-account.json");
  process.env.FIREBASE_PROJECT_ID = "fixture-local";
  getFirebaseAuth();
  expect(getApp().options.projectId).toBe("fixture-local");
  expect(getApp().options.credential).not.toBe(applicationDefault());
});
test("una ruta explícita inexistente y variables parciales permiten usar el archivo local", () => {
  accountFile("firebase-service-account.json");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(directory, "missing.json");
  process.env.FIREBASE_CLIENT_EMAIL = "fixture@example.invalid";
  getFirebaseAuth();
  expect(getApp().options.projectId).toBe("fixture-local");
});
test("rechaza un archivo de otro proyecto sin cambiar de identidad", () => {
  accountFile("firebase-service-account.json");
  process.env.FIREBASE_PROJECT_ID = "fixture-other";
  expect(getFirebaseAuth).toThrow("El proyecto Firebase no coincide");
  expect(getApps()).toHaveLength(0);
});
test("ADC es el último recurso cuando no hay variables completas ni archivos", () => {
  process.env.FIREBASE_PROJECT_ID = "fixture-cloud";
  getFirebaseAuth();
  expect(getApp().options.credential).toBe(applicationDefault());
  expect(getApp().options.projectId).toBe("fixture-cloud");
});
test("credenciales de entorno inválidas se rechazan sin exponer su contenido ni usar otro archivo", () => {
  envAccount();
  accountFile("firebase-service-account.json", "fixture-env");
  process.env.FIREBASE_PRIVATE_KEY = "private-fixture-never-log";
  expect(getFirebaseAuth).toThrow("No se pudieron cargar las credenciales Firebase de las variables de entorno.");
  expect(getApps()).toHaveLength(0);
});
test("un JSON malformado devuelve un error controlado sin contenido privado", () => {
  writeFileSync("firebase-service-account.json", "private-fixture-not-json");
  expect(getFirebaseAuth).toThrow("No se pudo leer el archivo de credenciales Firebase.");
});
test("emulador demo de desarrollo se mantiene separado de credenciales presentes", () => {
  envAccount();
  process.env.NODE_ENV = "development";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FIREBASE_PROJECT_ID = "demo-fixture";
  process.env.FIREBASE_PRIVATE_KEY = "invalid-fixture";
  getFirebaseAuth();
  expect(getApp().options.projectId).toBe("demo-fixture");
});
test("emuladores siguen prohibidos en producción o con proyecto real", () => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.NODE_ENV = "production";
  process.env.FIREBASE_PROJECT_ID = "demo-fixture";
  expect(getFirebaseAuth).toThrow("Los emuladores requieren");
  process.env.NODE_ENV = "development";
  process.env.FIREBASE_PROJECT_ID = "fixture-real";
  expect(getFirebaseAuth).toThrow("Los emuladores requieren");
});
