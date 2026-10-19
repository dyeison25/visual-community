// Verificación de solo lectura. --gemini realiza UNA generación de texto facturable.
// No crea usuarios, no modifica Firestore y no publica ni reemplaza el índice.
import { getFirestore } from "firebase-admin/firestore";
import { getSecurityRules } from "firebase-admin/security-rules";
import { getFirebaseAuth } from "../src/config/firebase.config";
import { getCommunities } from "../src/services/minenergia/minenergia.service";
import { getCommunityMap } from "../src/services/minenergia/map.service";
import { getXmMetrics } from "../src/services/xm/xm.service";
import { cregService } from "../src/services/creg/creg.service";
import { searchIndex } from "../src/services/discovery/algolia.service";
import { buildInterestProfile } from "../src/services/discovery/interest.service";
import { rankContents } from "../src/services/discovery/recommendation.service";
import { generateAnswer } from "../src/services/chat/geminiService";
import { readFileSync } from "node:fs";
type Result = { service: string; ok: boolean; detail?: unknown; code?: string | number };
const results: Result[] = [];
async function check(service: string, action: () => Promise<unknown>) {
  try { const detail = await action(); results.push({ service, ok: true, detail }); }
  catch (error) {
    const value = error as { code?: string | number; status?: number };
    // No imprimir el objeto del SDK ni mensajes con cabeceras o credenciales.
    results.push({ service, ok: false, code: value.status || value.code || "unavailable" });
  }
}
await check("Firebase Authentication", async () => ({ readable: (await getFirebaseAuth().listUsers(1)).users.length >= 0 }));
await check("Firestore", async () => ({ readable: true, sampleSize: (await getFirestore().collection("profiles").limit(1).get()).size }));
await check("Firestore rules", async () => {
  const current = await getSecurityRules().getFirestoreRuleset();
  const remote = current.source.map(file => file.content).join("\n").replace(/\s+/g, "");
  const local = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8").replace(/\s+/g, "");
  if (remote !== local) throw { code: "rules_differ_review_required" };
  return { matchesLocal: true, writes: 0 };
});
await check("MinEnergia communities", async () => {
  const data = await getCommunities();
  if (data.status !== "ok") throw { code: data.status };
  return { status: data.status, records: data.data.communities.length, publicLinks: data.data.communities.every(row => row.sourceUrl.startsWith("https://") && !/MapServer|FeatureServer|\/query/.test(row.sourceUrl)) };
});
if (process.argv.includes("--map")) await check("MinEnergia map", async () => {
  const result = await getCommunityMap(); if (result.status !== "ok") throw { code: result.status };
  return { records: result.data.length, coordinates: result.data.filter(row => row.latitude !== null && row.longitude !== null).length };
});
await check("XM", async () => {
  const result = await getXmMetrics();
  if (result.status !== "ok") throw { code: result.status };
  return { status: result.status, metrics: result.data.map(metric => ({ id: metric.id, status: metric.status, date: metric.date })) };
});
await check("CREG curated catalogue", async () => {
  const result = await cregService.list(); return { status: result.status, documents: result.data.length, liveApi: false };
});
await check("Algolia and ranking", async () => {
  const profile = buildInterestProfile("read-only-verification", ["energy_communities"], []);
  const result = await searchIndex("comunidades", profile);
  if (!result.hits.length) throw { code: "empty_index_results" };
  const ranked = rankContents(result.hits, profile);
  if (process.argv.includes("--gemini")) await check("Gemini generation", async () => {
    const answer = await generateAnswer("¿Qué es una comunidad energética?", [], result.hits.slice(0, 3));
    return { answered: Boolean(answer.trim()), characters: answer.length };
  });
  return { hits: result.hits.length, recommendations: ranked.length, reasons: ranked.every(item => Boolean(item.reason)) };
});
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), writes: 0, results }, null, 2));
if (results.some(result => !result.ok)) process.exitCode = 1;
