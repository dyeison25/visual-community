import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { adminDb } from "./admin-db";
import { activityValue } from "./activity.service";
import type { ActivityRecord } from "./types";

export async function setEmailConsent(uid: string, enabled: boolean, origin: "onboarding" | "profile" = "profile", db: Firestore = adminDb()) {
  const profileRef = db.collection("profiles").doc(uid);
  const now = Timestamp.now();
  await db.runTransaction(async transaction => {
    const activityRef = db.collection("userActivity").doc(uid);
    const [profile, activity] = await transaction.getAll(profileRef, activityRef);
    if (!profile?.exists) throw new Error("Perfil no encontrado.");
    const previous = profile.data()?.emailNotifications as { enabled?: boolean; consentedAt?: unknown } | undefined;
    transaction.update(profileRef, {
      emailNotifications: {
        enabled,
        consentedAt: enabled ? (previous?.enabled ? previous.consentedAt || now : now) : previous?.consentedAt || null,
        revokedAt: enabled ? null : now,
        updatedAt: now,
      },
      updatedAt: now,
    });
    transaction.set(db.collection("notificationAudit").doc(), {
      userId: uid, action: enabled ? "consent_granted" : "consent_revoked", origin, timestamp: now,
    });
    // Cambiar el consentimiento también es actividad significativa, con fecha del servidor.
    transaction.set(activityRef, activityValue(uid, activity?.data() as Partial<ActivityRecord> | undefined, now, "interaction"), { merge: true });
  });
}
