import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAuth } from "../../config/firebase.config";
import { calculateUserMetrics } from "../user-metrics.service";
import type { AdminOverview, AdminUser, AdminUserDetail, AdminUsersPage } from "../../../../shared/admin";
import type { Interaction, UserProfile } from "../../../../shared/models";
import { profileTopics } from "../../../../shared/preferences";

import { participantIds } from "./participants";

const TTL = 60000;
const cache = new Map<string, { until: number; result: Promise<unknown> }>();
/** Reutiliza lecturas durante un minuto; el rol siempre se comprueba fuera de esta caché. */
function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const previous = cache.get(key);
  if (previous && previous.until > Date.now()) return previous.result as Promise<T>;
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  const result = load().catch(error => { cache.delete(key); throw error; });
  cache.set(key, { until: Date.now() + TTL, result });
  return result;
}
/** Limita a cuatro usuarios simultáneos para no lanzar decenas de consultas de golpe. */
async function mapLimited<T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await task(items[index]!); }
  }));
  return results;
}
function date(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
type Account = { uid: string; name: string | null; email: string | null; createdAt: string | null; lastSignInAt: string | null };
/** Authentication es la fuente del correo y las fechas de cuenta. Nunca devolvemos hashes o tokens. */
function accounts(): Promise<Account[]> {
  return memo("accounts", async () => {
    const result: Account[] = []; let nextPage: string | undefined;
    do {
      const page = await getFirebaseAuth().listUsers(1000, nextPage);
      result.push(...page.users.map(user => ({ uid: user.uid, name: user.displayName || null,
        email: user.email || null, createdAt: date(user.metadata.creationTime), lastSignInAt: date(user.metadata.lastSignInTime) })));
      nextPage = page.pageToken;
    } while (nextPage);
    return result.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || a.uid.localeCompare(b.uid));
  });
}
function activity(uid: string) {
  return memo("activity:" + uid, async () => {
    const [metrics, snapshot] = await Promise.all([
      calculateUserMetrics(uid),
      getFirestore().collection("profiles").doc(uid).collection("interactions").orderBy("timestamp", "desc").limit(20).get(),
    ]);
    const recent: Interaction[] = snapshot.docs.map(document => {
      const data = document.data();
      return { id: document.id, userId: uid, eventType: data.eventType, timestamp: data.timestamp?.toDate?.().toISOString() ?? null,
        contentId: typeof data.contentId === "string" ? data.contentId : "", source: data.source,
        metadata: { ...(typeof data.metadata?.path === "string" ? { path: data.metadata.path } : {}),
          ...(typeof data.metadata?.section === "string" ? { section: data.metadata.section } : {}) } };
    });
    return { metrics, recent };
  });
}
function userRow(account: Account, profile: UserProfile | null, totalInteractions: number): AdminUser {
  return { uid: account.uid, name: profile?.name || account.name || "Miembro", email: account.email,
    createdAt: account.createdAt, lastSignInAt: account.lastSignInAt, role: profile?.role === "admin" ? "admin" : "user",
    onboardingCompleted: profile?.onboardingCompleted === true, topics: profileTopics(profile),
    formats: profile?.preferences.formats || [], totalInteractions };
}
/** Lee los roles actuales antes de usar contadores en caché, incluso tras una promoción. */
async function participants() {
  const [all, profiles] = await Promise.all([accounts(), getFirestore().collection("profiles").select("role").get()]);
  const ids = participantIds(all.map(account => account.uid), profiles.docs.map(profile => ({ id: profile.id, role: profile.data().role })));
  const allowed = new Set(ids);
  return { ids, accounts: all.filter(account => allowed.has(account.uid)) };
}
/** Página de hasta 20 participantes; los administradores no ocupan lugares en la paginación. */
export async function getAdminUsers(offset = 0): Promise<AdminUsersPage> {
  const { accounts: all } = await participants(); const page = all.slice(offset, offset + 20);
  const profiles = page.length ? await getFirestore().getAll(...page.map(user => getFirestore().collection("profiles").doc(user.uid))) : [];
  const users = await mapLimited(page, async account => {
    const profile = profiles.find(item => item.id === account.uid)?.data() as UserProfile | undefined;
    const result = await activity(account.uid);
    return userRow(account, profile || null, result.metrics.totalInteractions);
  });
  return { users, total: all.length, offset, hasMore: offset + 20 < all.length, calculatedAt: new Date().toISOString() };
}
/** El uid solicitado solo se admite después de requireAdmin; no existe una ruta pública equivalente. */
export async function getAdminUser(uid: string): Promise<AdminUserDetail> {
  const user = await getFirebaseAuth().getUser(uid);
  const profile = await getFirestore().collection("profiles").doc(uid).get();
  if (profile.data()?.role === "admin") throw Object.assign(new Error("Not a participant"), { code: "auth/user-not-found" });
  const data = await activity(uid);
  return { user: userRow({ uid, name: user.displayName || null, email: user.email || null,
    createdAt: date(user.metadata.creationTime), lastSignInAt: date(user.metadata.lastSignInTime) }, profile.data() as UserProfile || null, data.metrics.totalInteractions),
    metrics: data.metrics, recent: data.recent };
}
/** Cuenta todo el historial por usuario, pero solo lee los últimos 20 documentos de cada uno. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const { accounts: allAccounts, ids: uids } = await participants();
  // Cambiar un rol cambia esta clave: no reutilizamos un resumen que incluía a un administrador.
  return memo("overview:" + JSON.stringify([uids, allAccounts.map(account => account.uid)]), async () => {
    const rows = await mapLimited(uids, activity);
    const sample = rows.flatMap(row => row.recent).sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    const typeCounts = new Map<string, number>();
    for (const event of sample) typeCounts.set(event.eventType, (typeCounts.get(event.eventType) || 0) + 1);
    const activeSince = Date.now() - 7 * 86400000;
    return {
      totalUsers: allAccounts.length,
      totalInteractions: rows.reduce((total, row) => total + row.metrics.totalInteractions, 0),
      contentViews: rows.reduce((total, row) => total + row.metrics.contentViews, 0),
      logins: rows.reduce((total, row) => total + row.metrics.logins, 0),
      activeUsersLast7Days: rows.filter(row => row.recent.some(event => event.timestamp && Date.parse(event.timestamp) >= activeSince)).length,
      calculatedAt: new Date().toISOString(), recent: sample.slice(0, 20),
      eventTypes: [...typeCounts].map(([eventType, count]) => ({ eventType, count })).sort((a, b) => b.count - a.count),
      sampleSize: sample.length,
      sampleDescription: "Frecuencias de una muestra de hasta 20 eventos recientes por perfil. Los contadores principales incluyen el historial de usuarios normales. Se excluyen todas las cuentas con rol administrador.",
    };
  });
}
