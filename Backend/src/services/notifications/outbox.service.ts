import { createHash, randomUUID } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import type { UserProfile } from "../../../../shared/models";
import { emailProvider, reminderSettings, senderAddress, SMTP_DAILY_ATTEMPT_LIMIT, SMTP_RETRY_WINDOW_MS } from "./config";
import { openEmail, payloadHash, sealEmail } from "./envelope";
import { tokenHash, TOKEN_LIFETIME_MS, unsubscribeToken } from "./unsubscribe.service";
import type { ActivityRecord, DispatchContext, FrozenEmail, ProviderResult, ReminderRecord } from "./types";

export const millis = (value: unknown): number => value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function" ? value.toMillis() : 0;
export const reminderId = (uid: string, cycleId: string) => createHash("sha256").update(JSON.stringify([uid, cycleId, "inactive-v1"])).digest("hex");
export type Claim = { id: string; leaseId: string; userId: string; cycleId: string; message: FrozenEmail; record: ReminderRecord };
const LEASE_MS = 5 * 60_000;
// Resend conserva claves 24 h. El margen de una hora evita reintentos en el límite.
const RETRY_WINDOW_MS = 23 * 60 * 60_000;
const ACTIVE = ["sending", "retryable", "uncertain"];

export function reminderReviewReason(record: ReminderRecord, now: number): string | undefined {
  const provider = record.provider ?? "resend";
  if (provider !== emailProvider()) return "provider_changed";
  if (provider === "gmail_smtp" && (record.status === "uncertain" || record.status === "sending" && record.dispatchStartedAt)) return "smtp_dispatch_outcome_unknown";
  if (millis(record.retryDeadlineAt) <= now || record.attemptCount >= reminderSettings().maxAttempts) return "recovery_window_or_attempt_limit";
}
export function eligible(profile: UserProfile | undefined, activity: ActivityRecord | undefined, now: number) {
  const settings = reminderSettings();
  return profile?.role !== "admin" && profile?.emailNotifications?.enabled === true && millis(profile.emailNotifications.consentedAt) > 0 && Boolean(activity?.cycleId)
    && millis(activity?.lastActiveAt) > 0 && now - Math.max(millis(activity?.lastActiveAt), millis(profile.emailNotifications.consentedAt)) >= settings.inactivityMs
    && (!activity?.lastReminderAcceptedAt || now - millis(activity.lastReminderAcceptedAt) >= settings.cooldownMs);
}

export async function claimReminder(db: Firestore, uid: string, cycleId: string, message?: FrozenEmail, now = Date.now()): Promise<Claim | null> {
  const id = reminderId(uid, cycleId); const ref = db.collection("emailReminders").doc(id);
  return db.runTransaction(async transaction => {
    const [profileDoc, activityDoc, reminderDoc] = await transaction.getAll(db.collection("profiles").doc(uid), db.collection("userActivity").doc(uid), ref);
    const profile = profileDoc!.data() as UserProfile | undefined; const activity = activityDoc!.data() as ActivityRecord | undefined;
    const old = reminderDoc!.data() as ReminderRecord | undefined; const timestamp = Timestamp.fromMillis(now);
    if (!eligible(profile, activity, now) || activity?.cycleId !== cycleId) {
      if (old && ACTIVE.includes(old.status) && millis(old.leaseUntil) <= now) transaction.update(ref, { status: "skipped", reason: "consent_or_activity_changed", leaseUntil: null, updatedAt: timestamp });
      return null;
    }
    if (old && (!ACTIVE.includes(old.status) || millis(old.leaseUntil) > now || millis(old.nextAttemptAt) > now)) return null;
    const reviewReason = old && reminderReviewReason(old, now);
    if (reviewReason) {
      transaction.update(ref, { status: "needs_review", reason: reviewReason, leaseUntil: null, updatedAt: timestamp }); return null;
    }
    let frozen: FrozenEmail;
    try {
      frozen = old ? openEmail(old.envelope) : message!;
      if (!frozen || (old && payloadHash(frozen) !== old.payloadHash)) throw new Error("Invalid frozen payload");
    } catch {
      if (old) transaction.update(ref, { status: "needs_review", reason: "payload_or_secret_changed", leaseUntil: null, updatedAt: timestamp });
      return null;
    }
    const leaseId = randomUUID(); const provider = old?.provider ?? (old ? "resend" : emailProvider());
    const record: ReminderRecord = old ? { ...old, provider, dispatchStartedAt: null, status: "sending", leaseId, leaseUntil: Timestamp.fromMillis(now + LEASE_MS), nextAttemptAt: null, attemptCount: old.attemptCount + 1 } : {
      provider, dispatchStartedAt: null,
      ...(provider === "gmail_smtp" ? { messageId: `<vc-${id}@${senderAddress(frozen.from).split("@")[1] || "localhost"}>` } : {}),
      userId: uid, cycleId, status: "sending", attemptCount: 1, idempotencyKey: "inactivity-" + id,
      payloadHash: payloadHash(frozen), envelope: sealEmail(frozen), leaseId, leaseUntil: Timestamp.fromMillis(now + LEASE_MS), nextAttemptAt: null,
      createdAt: timestamp, firstRequestAt: timestamp, retryDeadlineAt: Timestamp.fromMillis(now + (provider === "gmail_smtp" ? SMTP_RETRY_WINDOW_MS : RETRY_WINDOW_MS)),
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

/** Marca durable ANTES del transporte. Cuota móvil compartida entre ejecuciones y usuarios. */
export async function beginReminderDispatch(db: Firestore, claim: Claim, email: string, now = Date.now()): Promise<
  { status: "ready"; context: DispatchContext } | { status: "blocked" | "budget_exhausted" }
> {
  const settings = reminderSettings();
  if (!settings.enabled || settings.dryRun || settings.sendMode === "test" && !settings.testUserIds.has(claim.userId)) return { status: "blocked" };
  const provider = claim.record.provider ?? "resend";
  return db.runTransaction(async transaction => {
    const ref = db.collection("emailReminders").doc(claim.id);
    const budgetRef = db.collection("notificationJobs").doc("gmailSmtpUsage");
    const refs = [db.collection("profiles").doc(claim.userId), db.collection("userActivity").doc(claim.userId), ref];
    if (provider === "gmail_smtp") refs.push(budgetRef);
    const [profileDoc, activityDoc, reminderDoc, budgetDoc] = await transaction.getAll(...refs);
    const profile = profileDoc!.data() as UserProfile | undefined; const activity = activityDoc!.data() as ActivityRecord | undefined;
    const current = reminderDoc!.data() as ReminderRecord | undefined;
    if (current?.status !== "sending" || current.leaseId !== claim.leaseId || millis(current.leaseUntil) <= now || current.dispatchStartedAt) return { status: "blocked" } as const;
    const timestamp = Timestamp.fromMillis(now);
    if (provider !== emailProvider() || !eligible(profile, activity, now) || activity?.cycleId !== claim.cycleId || claim.message.to.length !== 1 || claim.message.to[0] !== email) {
      transaction.update(ref, { status: "skipped", reason: "consent_activity_email_or_provider_changed", leaseUntil: null, updatedAt: timestamp });
      return { status: "blocked" } as const;
    }
    if (provider === "gmail_smtp") {
      const raw = budgetDoc?.data()?.dispatches ?? [];
      if (!Array.isArray(raw) || raw.some(value => !millis(value))) throw new Error("No se pudo validar el registro de cuota SMTP.");
      const recent = (raw as Timestamp[]).filter(value => millis(value) > now - 86_400_000);
      if (recent.length >= SMTP_DAILY_ATTEMPT_LIMIT) {
        const next = Math.min(...recent.map(millis)) + 86_400_000;
        transaction.update(ref, { status: "retryable", leaseUntil: null, nextAttemptAt: Timestamp.fromMillis(next),
          attemptCount: Math.max(0, current.attemptCount - 1), lastErrorCode: "smtp_budget_exhausted", updatedAt: timestamp });
        transaction.update(ref.collection("attempts").doc(claim.leaseId), { status: "budget_deferred", finishedAt: timestamp });
        return { status: "budget_exhausted" } as const;
      }
      // Se reserva incluso si el proceso se interrumpe o el resultado es incierto. Nunca se devuelve el cupo.
      transaction.set(budgetRef, { dispatches: [...recent, timestamp], updatedAt: timestamp });
    }
    transaction.update(ref, { dispatchStartedAt: timestamp, updatedAt: timestamp });
    transaction.update(ref.collection("attempts").doc(claim.leaseId), { dispatchStartedAt: timestamp });
    return { status: "ready", context: { provider, createdAt: millis(claim.record.firstRequestAt), ...(claim.record.messageId ? { messageId: claim.record.messageId } : {}) } } as const;
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
      patch = { status: "accepted", ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}), ...(result.messageId ? { messageId: result.messageId } : {}), acceptedAt: timestamp };
      if (activity?.exists) transaction.update(activityRef, { lastReminderAcceptedAt: timestamp });
    } else if (result.status === "disabled" || result.status === "simulated") {
      patch = { status: "retryable", nextAttemptAt: timestamp, lastErrorCode: "sending_disabled" };
    } else if (result.status === "permanent") {
      patch = { status: "failed_permanent", lastErrorCode: result.code, lastErrorMessage: result.message };
    } else if (result.status === "uncertain" && claim.record.provider === "gmail_smtp") {
      patch = { status: "needs_review", nextAttemptAt: null, reason: "smtp_dispatch_outcome_unknown", lastErrorCode: result.code, lastErrorMessage: result.message };
    } else if (result.status === "retryable" || result.status === "uncertain" || result.status === "account_error") {
      const exhausted = claim.record.attemptCount >= reminderSettings().maxAttempts;
      const status = result.status === "account_error" ? "retryable" : result.status;
      const delay = claim.record.provider === "gmail_smtp" ? 86_400_000 : (claim.record.attemptCount === 1 ? 15 : 60) * 60_000;
      patch = { status: exhausted ? "needs_review" : status, nextAttemptAt: Timestamp.fromMillis(now + delay), lastErrorCode: result.code, lastErrorMessage: result.message };
    } else { throw new Error("Unexpected email result"); }
    transaction.update(ref, { ...patch, leaseUntil: null, updatedAt: timestamp });
    transaction.update(ref.collection("attempts").doc(claim.leaseId), { status: patch.status, finishedAt: timestamp,
      ...(result.status === "accepted" && result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}) });
  });
}
