// Herramientas de pruebas: solo permiten actuar sobre las cuentas desechables de esta suite.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
function services() {
  const real = process.env.VC_E2E_REAL === "true";
  const name = real ? "visual-community-e2e-real" : "visual-community-e2e-demo";
  let app = getApps().find(item => item.name === name);
  if (!app) {
    if (real) {
      if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("La prueba real no permite emuladores.");
      const account = JSON.parse(readFileSync(resolve("Backend/firebase-service-account.json"), "utf8"));
      app = initializeApp({ credential: cert(account), projectId: account.project_id }, name);
    } else {
      if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099")
        throw new Error("Las pruebas locales requieren los emuladores explícitos.");
      app = initializeApp({ projectId: "demo-visual-community" }, name);
    }
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}
async function ownTestAccount(uid: string, email: string) {
  if (!email.startsWith("vc-") || !email.endsWith("@example.invalid")) throw new Error("Solo se admiten cuentas E2E desechables.");
  const result = services(); const user = await result.auth.getUser(uid);
  if (user.email !== email) throw new Error("El uid no coincide con la cuenta de prueba.");
  return result;
}
export async function setTestRole(uid: string, email: string, role: "user" | "admin") {
  const { db } = await ownTestAccount(uid, email);
  await db.collection("profiles").doc(uid).update({ role });
}
export async function readTestState(uid: string, email: string) {
  const { db } = await ownTestAccount(uid, email);
  const [profile, events] = await Promise.all([
    db.collection("profiles").doc(uid).get(),
    db.collection("profiles").doc(uid).collection("interactions").orderBy("timestamp", "desc").get(),
  ]);
  return { profile: profile.data(), events: events.docs.map(doc => ({ ...doc.data(), id: doc.id })) };
}
export async function cleanupTestAccount(uid: string, email: string) {
  const { auth, db } = await ownTestAccount(uid, email);
  const events = await db.collection("profiles").doc(uid).collection("interactions").get();
  for (let start = 0; start < events.size; start += 400) {
    const batch = db.batch(); events.docs.slice(start, start + 400).forEach(doc => batch.delete(doc.ref)); await batch.commit();
  }
  await db.collection("profiles").doc(uid).collection("interestProfile").doc("current").delete();
  await db.collection("profiles").doc(uid).delete();
  await db.collection("userMetrics").doc(uid).delete();
  await auth.deleteUser(uid);
}
