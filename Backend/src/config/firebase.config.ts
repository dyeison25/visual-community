import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Prepara la conexión del backend con Firebase una sola vez y devuelve Authentication.
 * Prioriza variables privadas, archivo indicado, archivo local y finalmente ADC.
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
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      if (projectId?.trim() && clientEmail?.trim() && privateKey?.trim()) {
        try {
          initializeApp({
            credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") }),
            projectId,
          });
        } catch {
          // No propagar mensajes del SDK que puedan incluir material privado.
          throw new Error("No se pudieron cargar las credenciales Firebase de las variables de entorno.");
        }
      } else {
        const paths = [process.env.GOOGLE_APPLICATION_CREDENTIALS, "firebase-service-account.json"]
          .filter((path): path is string => Boolean(path?.trim()))
          .map(path => resolve(path));
        const path = paths.find(candidate => existsSync(candidate));
        if (path) {
          let account;
          try {
            account = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
            if (!account || typeof account !== "object" || Array.isArray(account)) throw new Error();
          } catch {
            throw new Error("No se pudo leer el archivo de credenciales Firebase.");
          }
          if (projectId && account.project_id !== projectId) {
            throw new Error("El proyecto Firebase no coincide con la cuenta de servicio.");
          }
          try {
            initializeApp({ credential: cert(account), projectId: projectId || account.project_id });
          } catch {
            throw new Error("No se pudieron cargar las credenciales del archivo Firebase.");
          }
        } else {
          initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
        }
      }
    }
  }
  return getAuth();
}
