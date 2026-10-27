import { createHash, randomUUID } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "../../../../shared/models";
import { reminderSettings } from "./config";
import { openEmail, payloadHash, sealEmail } from "./envelope";
import { tokenHash, TOKEN_LIFETIME_MS, unsubscribeToken } from "./unsubscribe.service";
import type { ActivityRecord, FrozenEmail, ProviderResult, ReminderRecord } from "./types";

export const millis = (value: unknown): number => value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function" ? value.toMillis() : 0;
export const reminderId = (uid: string, cycleId: string) => createHash("sha256").update(JSON.stringify([uid, cycleId, "inactive-v1"])).digest("hex");
export type Claim = { id: string; leaseId: string; userId: string; cycleId: string; message: FrozenEmail; record: ReminderRecord };
const LEASE_MS = 5 * 60_000;
// Resend conserva claves 24 h. El margen de una hora evita reintentos en el límite.
const RETRY_WINDOW_MS = 23 * 60 * 60_000;
const ACTIVE = ["sending", "retryable", "uncertain"];
export function eligible(profile: UserProfile | undefined, activity: ActivityRecord | undefined, now: number) {
  const settings = reminderSettings();
  return profile?.role !== "admin" && profile?.emailNotifications?.enabled === true && millis(profile.emailNotifications.consentedAt) > 0 && Boolean(activity?.cycleId)
    && millis(activity?.lastActiveAt) > 0 && now - Math.max(millis(activity?.lastActiveAt), millis(profile.emailNotifications.consentedAt)) >= settings.inactivityMs
    && (!activity?.lastReminderAcceptedAt || now - millis(activity.lastReminderAcceptedAt) >= settings.cooldownMs);
}

export async function claimReminder(db: Firestore, uid: string, cycleId: string, message?: FrozenEmail, now = Date.now()): Promise<Claim | null> {
  const id = reminderId(uid, cycleId); const ref = db.collection("emailReminders").doc(id); const settings = reminderSettings();
  return db.runTransaction(async transaction => {
    const [profileDoc, activityDoc, reminderDoc] = await transaction.getAll(db.collection("profiles").doc(uid), db.collection("userActivity").doc(uid), ref);
    const profile = profileDoc!.data() as UserProfile | undefined; const activity = activityDoc!.data() as ActivityRecord | undefined;
    const old = reminderDoc!.data() as ReminderRecord | undefined; const timestamp = Timestamp.fromMillis(now);
    if (!eligible(profile, activity, now) || activity?.cycleId !== cycleId) {
      if (old && ACTIVE.includes(old.status) && millis(old.leaseUntil) <= now) transaction.update(ref, { status: "skipped", reason: "consent_or_activity_changed", leaseUntil: null, updatedAt: timestamp });
      return null;
    }
    if (old && (!ACTIVE.includes(old.status) || millis(old.leaseUntil) > now || millis(old.nextAttemptAt) > now)) return null;
    if (old && (millis(old.retryDeadlineAt) <= now || old.attemptCount >= settings.maxAttempts)) {
      transaction.update(ref, { status: "needs_review", reason: "recovery_window_or_attempt_limit", leaseUntil: null, updatedAt: timestamp }); return null;
    }
    let frozen: FrozenEmail;
    try {
      frozen = old ? openEmail(old.envelope) : message!;
      if (!frozen || (old && payloadHash(frozen) !== old.payloadHash)) throw new Error("Invalid frozen payload");
    } catch {
      if (old) transaction.update(ref, { status: "needs_review", reason: "payload_or_secret_changed", leaseUntil: null, updatedAt: timestamp });
      return null;
    }
    const leaseId = randomUUID();
    const record: ReminderRecord = old ? { ...old, status: "sending", leaseId, leaseUntil: Timestamp.fromMillis(now + LEASE_MS), nextAttemptAt: null, attemptCount: old.attemptCount + 1 } : {
      userId: uid, cycleId, status: "sending", attemptCount: 1, idempotencyKey: "inactivity-" + id,
      payloadHash: payloadHash(frozen), envelope: sealEmail(frozen), leaseId, leaseUntil: Timestamp.fromMillis(now + LEASE_MS), nextAttemptAt: null,
      createdAt: timestamp, firstRequestAt: timestamp, retryDeadlineAt: Timestamp.fromMillis(now + RETRY_WINDOW_MS),
    };
    if (!old) {
      const hash = tokenHash(unsubscribeToken(id));
      transaction.create(db.collection("unsubscribeTokens").doc(hash), { userId: uid, reminderId: id, createdAt: timestamp, expiresAt: Timestamp.fromMillis(now + TOKEN_LIFETIME_MS), usedAt: null });
    }
    transaction.set(ref, { ...record, updatedAt: timestamp });
    transaction.set(ref.collection("attempts").doc(leaseId), { number: record.attemptCount, status: "started", timestamp });
    return { id, leaseId, userId: uid, cycleId, message: frozen, record };
  });
}

/** Última comprobación inmediatamente antes del HTTP irreversible. */
export async function authorizeSend(db: Firestore, claim: Claim, email: string, now = Date.now()) {
  return db.runTransaction(async transaction => {
    const ref = db.collection("emailReminders").doc(claim.id);
    const [profileDoc, activityDoc, reminderDoc] = await transaction.getAll(db.collection("profiles").doc(claim.userId), db.collection("userActivity").doc(claim.userId), ref);
    const profile = profileDoc!.data() as UserProfile | undefined; const activity = activityDoc!.data() as ActivityRecord | undefined; const reminder = reminderDoc!.data();
    if (reminder?.status !== "sending" || reminder.leaseId !== claim.leaseId || millis(reminder.leaseUntil) <= now) return false;
    if (!eligible(profile, activity, now) || activity?.cycleId !== claim.cycleId || claim.message.to.length !== 1 || claim.message.to[0] !== email) {
      transaction.update(ref, { status: "skipped", reason: "consent_activity_or_email_changed", leaseUntil: null, updatedAt: Timestamp.fromMillis(now) }); return false;
    }
    return true;
  });
}

export async function finishReminder(db: Firestore, claim: Claim, result: ProviderResult, now = Date.now()) {
  return db.runTransaction(async transaction => {
    const ref = db.collection("emailReminders").doc(claim.id); const snapshot = await transaction.get(ref); const current = snapshot.data();
    if (current?.leaseId !== claim.leaseId || current.status !== "sending") return;
    const timestamp = Timestamp.fromMillis(now);
    const activityRef = db.collection("userActivity").doc(claim.userId);
    const activity = result.status === "accepted" ? await transaction.get(activityRef) : undefined;
    let patch: Record<string, unknown>;
    if (result.status === "accepted") {
      patch = { status: "accepted", providerMessageId: result.providerMessageId, acceptedAt: timestamp };
      if (activity?.exists) transaction.update(activityRef, { lastReminderAcceptedAt: timestamp });
    } else if (result.status === "disabled" || result.status === "simulated") {
      patch = { status: "retryable", nextAttemptAt: timestamp, lastErrorCode: "sending_disabled" };
    } else if (result.status === "permanent") {
      patch = { status: "failed_permanent", lastErrorCode: result.code, lastErrorMessage: result.message };
    } else if (result.status === "retryable" || result.status === "uncertain") {
      const exhausted = claim.record.attemptCount >= reminderSettings().maxAttempts;
      patch = { status: exhausted ? "needs_review" : result.status, nextAttemptAt: Timestamp.fromMillis(now + (claim.record.attemptCount === 1 ? 15 : 60) * 60_000), lastErrorCode: result.code, lastErrorMessage: result.message };
    } else { throw new Error("Unexpected email result"); }
    transaction.update(ref, { ...patch, leaseUntil: null, updatedAt: timestamp });
    transaction.update(ref.collection("attempts").doc(claim.leaseId), { status: patch.status, finishedAt: timestamp, ...(result.status === "accepted" ? { providerMessageId: result.providerMessageId } : {}) });
  });
}
