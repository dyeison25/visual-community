// Completa campos ausentes. No borra perfiles, eventos, intereses ni roles existentes.
import { getFirebaseAuth } from "../src/config/firebase.config";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { profileTopics } from "../../shared/preferences";
import type { UserProfile } from "../../shared/models";
const auth = getFirebaseAuth();
const db = getFirestore();
const apply = process.argv.includes("--apply");
let pageToken: string | undefined;
let inspected = 0, changed = 0;
do {
  const page = await auth.listUsers(1000, pageToken);
  for (const user of page.users) {
    inspected++;
    await db.runTransaction(async transaction => {
      const ref = db.collection("profiles").doc(user.uid);
      const snapshot = await transaction.get(ref);
      const current = snapshot.data();
      const patch: Record<string, unknown> = {};
      if (!current) {
        const rawName = user.displayName?.trim() || "Miembro";
        Object.assign(patch, {
          userId: user.uid, name: rawName.length >= 2 ? rawName.slice(0, 80) : "Miembro",
          interests: [], createdAt: Timestamp.fromDate(new Date(user.metadata.creationTime)),
        });
      }
      if (current?.role === undefined) patch.role = "user";
      if (current?.onboardingCompleted === undefined) patch.onboardingCompleted = false;
      if (!current?.preferences || current.preferences.topics === undefined || current.preferences.formats === undefined) {
        patch.preferences = {
          ...(current?.preferences || { compactMetrics: false }),
          topics: current?.preferences?.topics ?? profileTopics(current as UserProfile | null),
          formats: current?.preferences?.formats ?? [],
        };
      }
      if (Object.keys(patch).length) {
        if (apply) transaction.set(ref, { ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        changed++;
      }
    });
  }
  pageToken = page.pageToken;
} while (pageToken);
console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", inspected, profilesWithMissingFields: changed }));
