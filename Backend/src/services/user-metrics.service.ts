import { getFirestore, FieldValue } from "firebase-admin/firestore";
/**
 * Recibe el uid verificado y cuenta sus interacciones, consultas de contenido y logins.
 * Lee profiles/{uid}/interactions y guarda el resumen en userMetrics/{uid}.
 * Antes de guardar, comprueba que el perfil todavía exista.
 * Devuelve contadores básicos; no clasifica al usuario ni calcula riesgo de abandono.
 * Firebase Admin no aplica las reglas del cliente: la ruta debe verificar sesión y rol admin antes de llamar.
 */
export async function calculateUserMetrics(uid: string) {
  const db = getFirestore();
  const events = db.collection("profiles").doc(uid).collection("interactions");
  const [total, views, logins] = await Promise.all([
    events.count().get(),
    events.where("eventType", "in", ["VIEW_ARTICLE", "VIEW_REGULATION", "VIEW_METRIC", "VIEW_ENERGY_COMMUNITY"]).count().get(),
    events.where("eventType", "==", "LOGIN").count().get(),
  ]);
  const metrics = { userId: uid, totalInteractions: total.data().count, contentViews: views.data().count, logins: logins.data().count, calculatedAt: new Date().toISOString() };
  // Solo este backend autenticado escribe agregados. No hay clasificación ni reglas de permanencia.
  await db.runTransaction(async transaction => {
    const profile = await transaction.get(db.collection("profiles").doc(uid));
    if (!profile.exists) return; // Una cuenta sin perfil también puede figurar en Administración; no fabricamos su documento.
    transaction.set(db.collection("userMetrics").doc(uid), { ...metrics, updatedAt: FieldValue.serverTimestamp() });
  });
  return metrics;
}
