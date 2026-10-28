import { randomUUID } from "node:crypto";
import { FieldPath, Timestamp, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { UserProfile } from "../../../../shared/models";
import { getFirebaseAuth } from "../../config/firebase.config";
import { adminDb } from "./admin-db";
import { frontendUrl, reminderSettings, requiredEmailSettings } from "./config";
import { sendReminderEmail, unsubscribeUrl } from "./email.service";
import { personalizedReminder } from "./personalization.service";
import { unsubscribeToken } from "./unsubscribe.service";
import { beginReminderDispatch, claimReminder, eligible, finishReminder, millis, reminderId, reminderReviewReason } from "./outbox.service";
import type { DispatchContext, FrozenEmail, ProviderResult, ReminderRecord } from "./types";
import { activityForReminder } from "./activity.service";

type Report = { disabled: boolean; dryRun: boolean; locked: boolean; budgetLimited: boolean; scanned: number; candidates: number; accepted: number; deferred: number; skipped: number; needsReview: number; failures: number };
type Dependencies = {
  db?: Firestore;
  account?: (uid: string) => Promise<{ email?: string; disabled?: boolean }>;
  send?: (message: FrozenEmail, key: string, uid: string, context: DispatchContext) => Promise<ProviderResult>;
  now?: () => number;
  pause?: () => Promise<void>;
};
const ACTIVE = ["sending", "retryable", "uncertain"];

/** Cron independiente del navegador. Dry-run recorre los mismos candidatos sin escribir ni enviar. */
export async function runInactivityReminderJob(dependencies: Dependencies = {}): Promise<Report> {
  const settings = reminderSettings(); const now = dependencies.now || Date.now;
  const report: Report = { disabled: !settings.enabled, dryRun: settings.dryRun, locked: false, budgetLimited: false, scanned: 0, candidates: 0, accepted: 0, deferred: 0, skipped: 0, needsReview: 0, failures: 0 };
  if (!settings.enabled && !settings.dryRun) return report;
  frontendUrl(); // La URL de retorno es obligatoria y HTTPS en producción.
  if (!settings.dryRun) {
    requiredEmailSettings();
    if (settings.sendMode === "test" && !settings.testUserIds.size) throw new Error("El modo de envío test requiere REMINDER_TEST_USER_IDS.");
  }
  const db = dependencies.db || adminDb(); const leaseId = randomUUID();
  const stateRef = db.collection("notificationJobs").doc("inactivity");
  let cursors = { candidateCursor: "", recoveryCursor: "" };
  if (!settings.dryRun) {
    const state = await db.runTransaction(async transaction => {
      const state = (await transaction.get(stateRef)).data();
      if (millis(state?.leaseUntil) > now()) return null;
      transaction.set(stateRef, { leaseId, leaseUntil: Timestamp.fromMillis(now() + 20 * 60_000) }, { merge: true });
      return { candidateCursor: String(state?.candidateCursor || ""), recoveryCursor: String(state?.recoveryCursor || "") };
    });
    if (!state) { report.locked = true; return report; }
    cursors = state;
  }
  const account = dependencies.account || (uid => getFirebaseAuth().getUser(uid));
  const send = dependencies.send || sendReminderEmail;
  // Se transmite secuencialmente. El cupo SMTP adicional se reserva en Firestore.
  const pause = dependencies.pause || (() => new Promise<void>(resolve => setTimeout(resolve, 600)));
  const seen = new Set<string>();
  let stopped = false;

  async function processUser(uid: string, cycleId: string, profile: UserProfile, existing?: ReminderRecord) {
    const id = reminderId(uid, cycleId);
    if (seen.has(id)) return;
    seen.add(id);
    if (settings.testUserIds.size && !settings.testUserIds.has(uid)) { report.skipped++; return; }
    if (existing && (!ACTIVE.includes(existing.status) || millis(existing.leaseUntil) > now() || millis(existing.nextAttemptAt) > now())) { report.skipped++; return; }
    if (existing && reminderReviewReason(existing, now())) {
      report.needsReview++;
      if (!settings.dryRun) await claimReminder(db, uid, cycleId, undefined, now());
      return;
    }
    if (settings.dryRun) {
      report.candidates++; return; // No Firebase Auth, no tokens, no escrituras y no proveedor.
    }
    let message: FrozenEmail | undefined;
    let email: string;
    try {
      const user = await account(uid);
      if (!user.email || user.disabled) { report.skipped++; return; }
      email = user.email;
      if (!existing) {
        const history = await db.collection("profiles").doc(uid).collection("interactions").orderBy("timestamp", "desc").limit(50).get();
        const content = personalizedReminder(profile, history.docs.map(doc => doc.data()));
        const id = reminderId(uid, cycleId); const token = unsubscribeToken(id); const unsubscribe = unsubscribeUrl(token); const { from } = requiredEmailSettings();
        message = { from, to: [email], subject: "Te esperamos en Visual Community", tags: [{ name: "reminder_id", value: id }],
          text: `Hola ${profile.name || "miembro"},\n\n${content.intro}\n\nRegresar: ${content.url}\n\nDejar de recibir recordatorios: ${unsubscribe}`,
          html: `<p>Hola ${escapeHtml(profile.name || "miembro")},</p><p>${escapeHtml(content.intro)}</p><p><a href="${escapeHtml(content.url)}">Regresar a Visual Community</a></p><p style="font-size:12px"><a href="${escapeHtml(unsubscribe)}">Dejar de recibir recordatorios</a></p>` };
      }
    } catch { report.failures++; return; }
    const claimed = await claimReminder(db, uid, cycleId, message, now());
    if (!claimed) {
      const state = (await db.collection("emailReminders").doc(id).get()).data();
      if (state?.status === "needs_review") report.needsReview++; else report.skipped++;
      return;
    }
    const dispatch = await beginReminderDispatch(db, claimed, email, now());
    if (dispatch.status === "budget_exhausted") { report.budgetLimited = true; report.deferred++; stopped = true; return; }
    if (dispatch.status !== "ready") { report.skipped++; return; }
    report.candidates++;
    let result: ProviderResult;
    try { result = await send(claimed.message, claimed.record.idempotencyKey, uid, dispatch.context); }
    catch { result = { status: "uncertain", code: "provider_interrupted", message: "No se confirmó el resultado del proveedor." }; }
    // Si Firestore falla después de la aceptación NO sobrescribimos el resultado con un error de envío.
    // Resend recupera con la misma clave; SMTP con transmisión iniciada pasa a revisión sin reenviar.
    try {
      await finishReminder(db, claimed, result, now());
      if (result.status === "accepted") report.accepted++;
      else if (result.status === "permanent") report.failures++;
      else if (result.status === "account_error") { report.failures++; if (claimed.record.attemptCount >= settings.maxAttempts) report.needsReview++; stopped = true; }
      else if (result.status === "uncertain" && claimed.record.provider === "gmail_smtp") { report.needsReview++; stopped = true; }
      else if ((result.status === "retryable" || result.status === "uncertain") && claimed.record.attemptCount >= settings.maxAttempts) report.needsReview++;
      else report.deferred++;
    } catch { report.failures++; stopped = true; }
    await pause();
  }

  async function scan(kind: "candidate" | "recovery") {
    const cursorField = kind === "candidate" ? "candidateCursor" : "recoveryCursor";
    let cursor = settings.dryRun ? "" : cursors[cursorField];
    for (let page = 0; page < settings.maxPages && !stopped; page++) {
      const base = kind === "candidate"
        ? db.collection("profiles").where("emailNotifications.enabled", "==", true)
        : db.collection("emailReminders").where("status", "in", ACTIVE);
      let query = base.orderBy(FieldPath.documentId()).limit(settings.batchSize);
      if (cursor) query = query.startAfter(cursor);
      const docs = await query.get();
      for (const doc of docs.docs) {
        if (stopped) break;
        report.scanned++;
        const existing = kind === "recovery" ? doc.data() as ReminderRecord : undefined;
        const uid = existing?.userId || doc.id;
        // La lista limita también las escrituras: filtrar antes de reparar actividad o reclamar recuperaciones.
        // Conserva la restricción opcional que ya existía cuando general recibe una lista no vacía.
        if (settings.testUserIds.size && !settings.testUserIds.has(uid)) { report.skipped++; continue; }
        const activity = await activityForReminder(db, uid, settings.dryRun);
        const profile = kind === "candidate" ? doc.data() as UserProfile : (await db.collection("profiles").doc(uid).get()).data() as UserProfile | undefined;
        if (!eligible(profile, activity, now()) || (existing && existing.cycleId !== activity?.cycleId)) {
          if (existing && !settings.dryRun) await claimReminder(db, uid, existing.cycleId, undefined, now());
          report.skipped++; continue;
        }
        const current = existing || (await db.collection("emailReminders").doc(reminderId(uid, activity!.cycleId)).get()).data() as ReminderRecord | undefined;
        await processUser(uid, activity!.cycleId, profile!, current);
      }
      // Si se detuvo el lote, no avanzar sobre documentos que no se llegaron a procesar.
      if (stopped) break;
      cursor = docs.size < settings.batchSize ? "" : (docs.docs.at(-1) as QueryDocumentSnapshot).id;
      if (!settings.dryRun) await stateRef.set({ [cursorField]: cursor }, { merge: true });
      if (!cursor) break;
    }
  }
  try { await scan("recovery"); await scan("candidate"); }
  finally {
    if (!settings.dryRun) await db.runTransaction(async transaction => {
      const state = (await transaction.get(stateRef)).data();
      if (state?.leaseId === leaseId) transaction.update(stateRef, { leaseUntil: null, updatedAt: Timestamp.fromMillis(now()), report });
    });
  }
  return report;
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]!); }
