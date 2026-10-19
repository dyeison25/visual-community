import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Prepara la conexión del backend con Firebase una sola vez y devuelve Authentication.
 * Usa la cuenta de servicio privada o las credenciales del entorno del servidor.
 * Comprueba que la cuenta corresponda al proyecto configurado.
 * Solo permite el emulador cuando se elige explícitamente un proyecto demo en desarrollo.
 */
export function getFirebaseAuth() {
  if (!getApps().length) {
    const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    if (emulator) {
      if (process.env.NODE_ENV === "production" || !process.env.FIREBASE_PROJECT_ID?.startsWith("demo-")) {
        throw new Error("Los emuladores requieren un proyecto demo y un entorno de desarrollo.");
      }
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    } else {
      const path = resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || "firebase-service-account.json");
      if (existsSync(path)) {
        const account = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
        if (process.env.FIREBASE_PROJECT_ID && account.project_id !== process.env.FIREBASE_PROJECT_ID) {
          throw new Error("El proyecto Firebase no coincide con la cuenta de servicio.");
        }
        initializeApp({ credential: cert(account), projectId: process.env.FIREBASE_PROJECT_ID || account.project_id });
      } else {
        initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
      }
    }
  }
  return getAuth();
}
