import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, deleteDoc, deleteField, collection, collectionGroup, getDocs, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { EVENT_TYPES } from "../shared/models";
let env: RulesTestEnvironment;
const profile = (uid: string) => ({ userId: uid, name: "Prueba reglas", interests: ["Energía solar"],
  preferences: { compactMetrics: false, topics: [], formats: [] }, role: "user", onboardingCompleted: false,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const event = (uid: string) => ({ userId: uid, eventType: "LOGIN", timestamp: serverTimestamp(), contentId: "", source: "Visual Community", metadata: {} });
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-visual-community-rules", firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8") } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), "profiles", "rules-admin"), { ...profile("rules-admin"), role: "admin" });
    await setDoc(doc(context.firestore(), "userMetrics", "rules-alice"), { userId: "rules-alice", totalInteractions: 3 });
  });
});
afterAll(async () => { await env.cleanup(); });
describe("Roles, encuesta y aislamiento por uid", () => {
  test("cada usuario crea y consulta únicamente su perfil", async () => {
    const alice = env.authenticatedContext("rules-alice").firestore(); const bob = env.authenticatedContext("rules-bob").firestore();
    await assertSucceeds(setDoc(doc(alice, "profiles", "rules-alice"), profile("rules-alice")));
    await assertSucceeds(getDoc(doc(alice, "profiles", "rules-alice")));
    await assertFails(getDoc(doc(bob, "profiles", "rules-alice")));
    await assertFails(setDoc(doc(bob, "profiles", "rules-alice"), profile("rules-alice")));
    await assertFails(getDocs(collection(alice, "profiles")));
  });
  test("no permite contraseñas, privilegios ni encuesta ya completa al crear", async () => {
    const db = env.authenticatedContext("rules-sensitive").firestore();
    const target = doc(db, "profiles", "rules-sensitive");
    await assertFails(setDoc(target, { ...profile("rules-sensitive"), password: "NuncaGuardar" }));
    await assertFails(setDoc(target, { ...profile("rules-sensitive"), role: "admin" }));
    await assertFails(setDoc(target, { ...profile("rules-sensitive"), onboardingCompleted: true }));
  });
  test("no puede elevar ni quitar el rol o borrar el perfil para recrearlo", async () => {
    const db = env.authenticatedContext("rules-escalation").firestore(); const ref = doc(db, "profiles", "rules-escalation");
    await assertSucceeds(setDoc(ref, profile("rules-escalation")));
    await assertFails(updateDoc(ref, { role: "admin", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { role: deleteField(), updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref));
    expect((await getDoc(ref)).data()?.role).toBe("user");
  });
  test("la encuesta exige temas válidos y no puede reiniciarse una vez completa", async () => {
    const db = env.authenticatedContext("rules-survey").firestore(); const ref = doc(db, "profiles", "rules-survey");
    await setDoc(ref, profile("rules-survey"));
    await assertFails(updateDoc(ref, { onboardingCompleted: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { "preferences.topics": ["unknown"], onboardingCompleted: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { "preferences.topics": ["energy_communities"], onboardingCompleted: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { onboardingCompleted: false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { "preferences.topics": [], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { "preferences.topics": ["regulation", "regulation"], updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { "preferences.topics": ["regulation"], "preferences.formats": ["education"], name: "Nombre nuevo", updatedAt: serverTimestamp() }));
  });
  test("los perfiles antiguos pueden añadir campos sin elevar su rol ni borrar intereses", async () => {
    await env.withSecurityRulesDisabled(async context => {
      const legacy = profile("rules-legacy");
      const { role, onboardingCompleted, ...rest } = legacy;
      await setDoc(doc(context.firestore(), "profiles", "rules-legacy"), { ...rest, preferences: { compactMetrics: true } });
    });
    const db = env.authenticatedContext("rules-legacy").firestore(); const ref = doc(db, "profiles", "rules-legacy");
    await assertFails(updateDoc(ref, { role: "admin", onboardingCompleted: false, preferences: { compactMetrics: true, topics: [], formats: [] }, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { role: "user", onboardingCompleted: false, preferences: { compactMetrics: true, topics: ["renewable_energy"], formats: [] }, updatedAt: serverTimestamp() }));
    expect((await getDoc(ref)).data()?.interests).toEqual(["Energía solar"]);
  });
  test("anónimos no leen ni escriben", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "profiles", "rules-alice")));
    await assertFails(setDoc(doc(db, "profiles", "rules-alice", "interactions", "anonymous"), event("rules-alice")));
  });
  test("todos los eventos siguen permitidos, con uid propio y hora del servidor", async () => {
    const db = env.authenticatedContext("rules-events").firestore();
    for (const eventType of EVENT_TYPES) await assertSucceeds(setDoc(doc(db, "profiles", "rules-events", "interactions", eventType), { ...event("rules-events"), eventType }));
    await assertFails(setDoc(doc(db, "profiles", "rules-events", "interactions", "forged-uid"), event("someone-else")));
    await assertFails(setDoc(doc(db, "profiles", "rules-events", "interactions", "forged-time"), { ...event("rules-events"), timestamp: Timestamp.fromMillis(0) }));
    await assertFails(setDoc(doc(db, "profiles", "rules-events", "interactions", "forged-type"), { ...event("rules-events"), eventType: "ADMIN" }));
    await assertFails(setDoc(doc(db, "profiles", "rules-events", "interactions", "extra"), { ...event("rules-events"), metadata: { email: "no@example.invalid" } }));
  });
  test("el seguimiento es de lectura administrativa incluso por acceso directo", async () => {
    const db = env.authenticatedContext("rules-events").firestore();
    await assertFails(getDocs(collection(db, "profiles", "rules-events", "interactions")));
    await assertFails(getDocs(collection(db, "profiles", "rules-alice", "interactions")));
    await assertFails(getDocs(collectionGroup(db, "interactions")));
    await assertFails(getDoc(doc(db, "userMetrics", "rules-alice")));
    const admin = env.authenticatedContext("rules-admin").firestore();
    await assertSucceeds(getDocs(collection(admin, "profiles")));
    await assertSucceeds(getDocs(collectionGroup(admin, "interactions")));
    await assertSucceeds(getDoc(doc(admin, "userMetrics", "rules-alice")));
  });
  test("ni administradores pueden alterar eventos, roles o métricas desde el navegador", async () => {
    const db = env.authenticatedContext("rules-admin").firestore();
    await assertFails(updateDoc(doc(db, "profiles", "rules-events", "interactions", "LOGIN"), { eventType: "REGISTER" }));
    await assertFails(deleteDoc(doc(db, "profiles", "rules-events", "interactions", "LOGIN")));
    await assertFails(updateDoc(doc(db, "profiles", "rules-alice"), { role: "admin", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(db, "userMetrics", "rules-alice"), { score: 9999 }));
  });
  test("la revocación del rol se aplica sin cambiar el token", async () => {
    const admin = env.authenticatedContext("rules-admin").firestore();
    await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), "profiles", "rules-admin"), { role: "user" }));
    await assertFails(getDocs(collection(admin, "profiles")));
    await assertFails(getDocs(collectionGroup(admin, "interactions")));
  });
});

test("metadatos de descubrimiento y perfil de intereses permanecen protegidos", async()=>{
  const db=env.authenticatedContext("rules-discovery").firestore();
  await assertSucceeds(setDoc(doc(db,"profiles","rules-discovery"),profile("rules-discovery")));
  await assertSucceeds(setDoc(doc(db,"profiles","rules-discovery","interactions","search"),{
    ...event("rules-discovery"),eventType:"SEARCH",metadata:{category:"regulation",queryLength:30}
  }));
  await assertFails(setDoc(doc(db,"profiles","rules-discovery","interactions","raw-query"),{
    ...event("rules-discovery"),eventType:"SEARCH",metadata:{query:"texto privado"}
  }));
  await assertFails(setDoc(doc(db,"profiles","rules-discovery","interestProfile","current"),{affinity:{regulation:100}}));
  await assertFails(getDoc(doc(db,"profiles","rules-discovery","interestProfile","current")));
  await assertFails(setDoc(doc(db,"profiles","rules-discovery","interactions","bad-category"),{
    ...event("rules-discovery"),eventType:"SEARCH",metadata:{category:"unknown"}
  }));
});
