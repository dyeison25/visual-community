import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { adminDb } from "./admin-db";
import { reminderSettings } from "./config";
import type { ActivityRecord } from "./types";

const TOUCH_MINIMUM_MS = 15 * 60_000;
export type ActivityKind = "session_resume" | "interaction";
export function activityValue(uid: string, previous: Partial<ActivityRecord> | undefined, now: Timestamp, kind: ActivityKind) {
  const last = previous?.lastActiveAt?.toMillis?.() || 0;
  return {
    userId: uid,
    cycleId: !last || now.toMillis() - last >= reminderSettings().inactivityMs ? randomUUID() : previous?.cycleId || randomUUID(),
    lastActiveAt: now, lastMeaningfulEvent: kind, updatedAt: now,
    ...(previous?.lastReminderAcceptedAt ? { lastReminderAcceptedAt: previous.lastReminderAcceptedAt } : {}),
  };
}

/**
 * El ciclo es estable durante una sesión/periodo activo. Solo cambia cuando el
 * usuario vuelve tras superar el umbral de inactividad; no se incrementa al tocar actividad.
 */
export async function touchActivity(uid: string, kind: ActivityKind, db: Firestore = adminDb(), time = Date.now()) {
  const ref = db.collection("userActivity").doc(uid);
  const now = Timestamp.fromMillis(time);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data(); const previous = data?.lastActiveAt?.toMillis?.() as number | undefined;
    if (previous && now.toMillis() - previous < TOUCH_MINIMUM_MS) {
      return { cycleId: String(data?.cycleId || ""), touched: false };
    }
    const value = activityValue(uid, data as Partial<ActivityRecord> | undefined, now, kind);
    transaction.set(ref, value, { merge: true });
    return { cycleId: value.cycleId, touched: true };
  });
}

/**
 * Respaldo para un toque HTTP perdido: los eventos ya confirmados por Firestore
 * tienen fecha del servidor y permiten detectar un retorno aunque Render estuviera detenido.
 */
export async function activityForReminder(db: Firestore, uid: string, dryRun: boolean): Promise<ActivityRecord | undefined> {
  const ref = db.collection("userActivity").doc(uid);
  const [activityDoc, history] = await Promise.all([
    ref.get(), db.collection("profiles").doc(uid).collection("interactions").orderBy("timestamp", "desc").limit(1).get(),
  ]);
  const recorded = activityDoc.data() as ActivityRecord | undefined;
  const timestamp = history.docs[0]?.data().timestamp as Timestamp | undefined;
  if (!timestamp?.toMillis || timestamp.toMillis() > Date.now() || timestamp.toMillis() <= (recorded?.lastActiveAt?.toMillis?.() || 0)) return recorded;
  const next = (previous: ActivityRecord | undefined): ActivityRecord => ({
    ...previous, userId: uid,
    cycleId: previous && timestamp.toMillis() - previous.lastActiveAt.toMillis() < reminderSettings().inactivityMs ? previous.cycleId : randomUUID(),
    lastActiveAt: timestamp,
  });
  if (dryRun) return next(recorded);
  return db.runTransaction(async transaction => {
    const previous = (await transaction.get(ref)).data() as ActivityRecord | undefined;
    if (previous && previous.lastActiveAt.toMillis() >= timestamp.toMillis()) return previous;
    const value = next(previous);
    transaction.set(ref, { ...value, lastMeaningfulEvent: "confirmed_interaction", updatedAt: Timestamp.now() }, { merge: true }); return value;
  });
}
