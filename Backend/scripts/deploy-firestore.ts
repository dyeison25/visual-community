import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";
const account = JSON.parse(readFileSync(resolve("firebase-service-account.json"), "utf8"));
const app = initializeApp({ credential: cert(account), projectId: account.project_id }, "rules-deployment");
const rules = getSecurityRules(app);
const source = readFileSync(resolve("../firestore.rules"), "utf8");
try {
  const current = await rules.getFirestoreRuleset();
  const previous = current.source.map(file => file.content).join("\n");
  const normalized = previous.replace(/\s+/g, "");
  const initialDeny = normalized === "rules_version='2';servicecloud.firestore{match/databases/{database}/documents{match/{document=**}{allowread,write:iffalse;}}}";
  if (!initialDeny && previous !== source && !previous.includes("Métricas internas y futuros resultados del motor")) {
    throw new Error("Existen reglas diferentes: revísalas antes de publicar para conservar sus permisos.");
  }
  mkdirSync(resolve("../artifacts"), { recursive: true });
  writeFileSync(resolve("../artifacts/firestore-rules-before.txt"), previous);
  await rules.releaseFirestoreRulesetFromSource(source);
  console.log("Reglas Firestore publicadas. Perfiles e interacciones por uid. Historial con índice automático por timestamp.");
} catch (error: any) {
  console.error("No se completó la publicación:", error.response?.status || (error.message?.startsWith("Existen reglas") ? error.message : "unavailable"));
  process.exitCode = 1;
}
