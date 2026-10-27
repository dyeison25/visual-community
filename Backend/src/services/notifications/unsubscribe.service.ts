import { createHash, createHmac } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { adminDb } from "./admin-db";
import { notificationSecret } from "./config";

export const TOKEN_LIFETIME_MS = 45 * 86_400_000;
export function unsubscribeToken(reminderId: string, secret = notificationSecret()) {
  return createHmac("sha256", secret).update("visual-community:unsubscribe:v1:" + reminderId).digest("base64url");
}
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function isOpaqueToken(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{40,100}$/.test(value); }

/** No recibe uid: solo el token vincula de forma criptográfica la baja con un único perfil. */
export async function unsubscribeWithToken(token: string, db: Firestore = adminDb(), time = Date.now()) {
  if (!isOpaqueToken(token)) return false;
  const hash = tokenHash(token); const tokenRef = db.collection("unsubscribeTokens").doc(hash);
  return db.runTransaction(async transaction => {
    const record = await transaction.get(tokenRef); const data = record.data();
    if (!record.exists || !data || data.usedAt || !data.expiresAt?.toMillis || data.expiresAt.toMillis() <= time) return false;
    const profileRef = db.collection("profiles").doc(String(data.userId)); const profile = await transaction.get(profileRef);
    if (!profile.exists) return false;
    const now = Timestamp.now();
    transaction.update(profileRef, { emailNotifications: { enabled: false, consentedAt: profile.data()?.emailNotifications?.consentedAt || null, revokedAt: now, updatedAt: now }, updatedAt: now });
    transaction.update(tokenRef, { usedAt: now });
    transaction.set(db.collection("notificationAudit").doc(), { userId: data.userId, action: "unsubscribe_link", reminderId: data.reminderId, timestamp: now });
    return true;
  });
}
