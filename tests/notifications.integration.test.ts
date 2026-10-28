import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { initializeApp, deleteApp, getFirestore, Timestamp } from "../Backend/tests/support/notifications";
import { setEmailConsent } from "../Backend/src/services/notifications/consent.service";
import { touchActivity } from "../Backend/src/services/notifications/activity.service";
import { claimReminder, authorizeSend, beginReminderDispatch, finishReminder, reminderId } from "../Backend/src/services/notifications/outbox.service";
import { runInactivityReminderJob } from "../Backend/src/services/notifications/reminder.service";
import { unsubscribeToken, tokenHash, unsubscribeWithToken } from "../Backend/src/services/notifications/unsubscribe.service";
import type { FrozenEmail } from "../Backend/src/services/notifications/types";
import { openEmail } from "../Backend/src/services/notifications/envelope";

// Esta suite solo toca un proyecto demo dedicado; nunca admite credenciales/Firestore reales.
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") throw new Error("Ejecuta test:notifications con el emulador oficial.");
const app = initializeApp({ projectId: "demo-visual-community-notifications" }, "notifications-integration");
const db = getFirestore(app); const DAY = 86_400_000; let clock = Date.now();
const keys = ["REMINDER_ENABLED", "REMINDER_DRY_RUN", "REMINDER_SEND_MODE", "REMINDER_TEST_USER_IDS", "RESEND_API_KEY", "EMAIL_FROM", "NOTIFICATION_TOKEN_SECRET", "FRONTEND_URL", "REMINDER_BATCH_SIZE", "REMINDER_INACTIVITY_DAYS", "REMINDER_MAX_ATTEMPTS", "EMAIL_PROVIDER", "SMTP_USER", "SMTP_APP_PASSWORD"];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const message: FrozenEmail = { from: "fixture@example.invalid", to: ["recipient@example.invalid"], subject: "Fixture", html: "<p>Fixture</p>", text: "Fixture", tags: [] };
const collections = ["profiles", "userActivity", "emailReminders", "unsubscribeTokens", "notificationAudit", "notificationJobs"];
beforeAll(() => {
  Object.assign(process.env, { RESEND_API_KEY: "fixture-not-real", EMAIL_FROM: "fixture@example.invalid", NOTIFICATION_TOKEN_SECRET: "notification-fixture-secret-".repeat(2), FRONTEND_URL: "https://sistemagestionpermanencia.web.app" });
});
beforeEach(async () => {
  clock = Date.now();
  Object.assign(process.env, { REMINDER_ENABLED: "true", REMINDER_DRY_RUN: "false", REMINDER_SEND_MODE: "test", REMINDER_TEST_USER_IDS: "alice,bob", REMINDER_BATCH_SIZE: "50", REMINDER_INACTIVITY_DAYS: "4", REMINDER_MAX_ATTEMPTS: "3", EMAIL_PROVIDER: "resend", EMAIL_FROM: message.from, NOTIFICATION_TOKEN_SECRET: "notification-fixture-secret-".repeat(2) });
  for (const name of collections) for (const doc of (await db.collection(name).get()).docs) await db.recursiveDelete(doc.ref);
});
afterAll(async () => {
  await deleteApp(app);
  for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
});
async function seed(uid = "alice", enabled = true, days = 5) {
  await db.collection("profiles").doc(uid).set({ userId: uid, name: "Participante", role: "user", interests: [], preferences: { compactMetrics: false, topics: ["regulation"], formats: [] }, emailNotifications: { enabled, consentedAt: enabled ? Timestamp.fromMillis(clock - 10 * DAY) : null } });
  await db.collection("userActivity").doc(uid).set({ userId: uid, cycleId: "cycle-1", lastActiveAt: Timestamp.fromMillis(clock - days * DAY) });
}
const job = (extra: Parameters<typeof runInactivityReminderJob>[0] = {}) => runInactivityReminderJob({ db, now: () => clock, account: async () => ({ email: message.to[0] }), pause: async () => {}, ...extra });

// Compara también updateTime: detecta escrituras aunque vuelvan a guardar los mismos datos.
async function userRecords(uid: string) {
  const owned = await Promise.all(["emailReminders", "unsubscribeTokens", "notificationAudit"].map(name => db.collection(name).where("userId", "==", uid).get()));
  const roots = [db.doc("profiles/" + uid), db.doc("userActivity/" + uid), ...owned.flatMap(snapshot => snapshot.docs.map(doc => doc.ref))];
  const records: { path: string; data: unknown; updateTime: unknown }[] = [];
  async function collect(ref: typeof roots[number]) {
    const snapshot = await ref.get();
    records.push({ path: ref.path, data: snapshot.data() ?? null, updateTime: snapshot.updateTime ?? null });
    for (const collection of await ref.listCollections()) for (const doc of (await collection.get()).docs) await collect(doc.ref);
  }
  for (const ref of roots) await collect(ref);
  return records.sort((a, b) => a.path.localeCompare(b.path));
}

test("el consentimiento conserva fechas y deja una auditoría; solo cambia el perfil indicado", async () => {
  await seed("alice", false); await seed("bob", false);
  await setEmailConsent("alice", true, "profile", db);
  const granted = (await db.doc("profiles/alice").get()).data()!.emailNotifications;
  expect(granted.enabled).toBe(true); expect(granted.consentedAt.toMillis()).toBeGreaterThan(0);
  await setEmailConsent("alice", false, "profile", db);
  const revoked = (await db.doc("profiles/alice").get()).data()!.emailNotifications;
  expect(revoked.enabled).toBe(false); expect(revoked.consentedAt.toMillis()).toBe(granted.consentedAt.toMillis()); expect(revoked.revokedAt).toBeTruthy();
  expect((await db.doc("profiles/bob").get()).data()!.emailNotifications.enabled).toBe(false);
  expect((await db.collection("notificationAudit").get()).size).toBe(2);
});
test("toques periódicos mantienen el ciclo; un regreso después de cuatro días crea otro", async () => {
  const initial = await touchActivity("alice", "session_resume", db, clock);
  expect((await touchActivity("alice", "interaction", db, clock + 10 * 60_000)).touched).toBe(false);
  expect((await touchActivity("alice", "interaction", db, clock + 16 * 60_000)).cycleId).toBe(initial.cycleId);
  expect((await touchActivity("alice", "session_resume", db, clock + 5 * DAY)).cycleId).not.toBe(initial.cycleId);
});
test("modo seco valida consentimiento, actividad y roles sin escribir ni invocar correo/Auth", async () => {
  await seed(); await seed("no-consent", false); await seed("recent", true, 1); await seed("admin"); await db.doc("profiles/admin").update({ role: "admin" });
  process.env.REMINDER_DRY_RUN = "true"; process.env.REMINDER_TEST_USER_IDS = "";
  let calls = 0;
  const report = await job({ send: async () => { calls++; throw new Error("Nunca enviar"); }, account: async () => { calls++; throw new Error("No recuperar correos"); } });
  expect(report.candidates).toBe(1); expect(calls).toBe(0);
  for (const name of ["emailReminders", "unsubscribeTokens", "notificationJobs"]) expect((await db.collection(name).get()).empty).toBe(true);
});
test("test exige lista explícita; la lista filtra destinatarios y no redirige información de terceros", async () => {
  await seed(); await seed("bob"); process.env.REMINDER_TEST_USER_IDS = "";
  const before = await Promise.all([userRecords("alice"), userRecords("bob")]);
  await expect(job()).rejects.toThrow("REMINDER_TEST_USER_IDS");
  expect(await Promise.all([userRecords("alice"), userRecords("bob")])).toEqual(before);
  expect((await db.collection("notificationJobs").get()).empty).toBe(true);
  process.env.REMINDER_TEST_USER_IDS = "alice"; let recipients: string[] = [];
  const report = await job({ send: async (frozen, _key, uid) => { recipients = frozen.to; expect(uid).toBe("alice"); return { status: "accepted", providerMessageId: "id" }; } });
  expect(report.accepted).toBe(1); expect(recipients).toEqual(message.to);
  expect((await db.collection("emailReminders").get()).size).toBe(1);
});
test("test filtra candidatos antes de reparar o crear actividad de usuarios excluidos", async () => {
  await seed(); await seed("bob"); await seed("carol");
  await db.doc("profiles/alice/interactions/latest").set({ eventType: "VIEW_DASHBOARD", timestamp: Timestamp.fromMillis(clock - 4.5 * DAY) });
  await db.doc("profiles/bob/interactions/latest").set({ eventType: "LOGIN", timestamp: Timestamp.fromMillis(clock - 60_000) });
  await db.doc("userActivity/carol").delete();
  await db.doc("profiles/carol/interactions/latest").set({ eventType: "LOGIN", timestamp: Timestamp.fromMillis(clock - 5 * DAY) });
  process.env.REMINDER_TEST_USER_IDS = "alice";
  const before = await Promise.all([userRecords("bob"), userRecords("carol")]);
  const lookedUp: string[] = []; const sent: string[] = [];
  const report = await job({ account: async uid => { lookedUp.push(uid); return { email: message.to[0] }; }, send: async (_message, _key, uid) => { sent.push(uid); return { status: "accepted", providerMessageId: "alice-only" }; } });
  expect(report.accepted).toBe(1); expect(lookedUp).toEqual(["alice"]); expect(sent).toEqual(["alice"]);
  expect((await db.doc("userActivity/alice").get()).data()!.lastActiveAt.toMillis()).toBe(clock - 4.5 * DAY);
  expect(await Promise.all([userRecords("bob"), userRecords("carol")])).toEqual(before);
});
test("test recupera solo el UID permitido sin cancelar, renovar leases ni modificar intentos ajenos", async () => {
  for (const uid of ["alice", "bob", "carol", "dave", "erin"]) await seed(uid);
  const alice = (await claimReminder(db, "alice", "cycle-1", message, clock - 20 * 60_000))!;
  await finishReminder(db, alice, { status: "uncertain", code: "timeout", message: "Prueba local" }, clock - 16 * 60_000);
  await claimReminder(db, "bob", "cycle-1", message, clock - 6 * 60_000);
  await db.doc("profiles/bob").update({ "emailNotifications.enabled": false });
  await claimReminder(db, "carol", "cycle-1", message, clock - 6 * 60_000);
  await db.doc("profiles/carol/interactions/return").set({ eventType: "LOGIN", timestamp: Timestamp.fromMillis(clock - 60_000) });
  await claimReminder(db, "dave", "cycle-1", message, clock - DAY);
  await claimReminder(db, "erin", "cycle-1", message, clock); // Lease ajeno todavía vigente.
  const excluded = ["bob", "carol", "dave", "erin"];
  const before = await Promise.all(excluded.map(userRecords));
  process.env.REMINDER_TEST_USER_IDS = "alice";
  const sent: string[] = [];
  const report = await job({ send: async (frozen, key, uid) => {
    sent.push(uid); expect(frozen).toEqual(message); expect(key).toBe(alice.record.idempotencyKey);
    return { status: "accepted", providerMessageId: "recovered-alice" };
  } });
  expect(report.accepted).toBe(1); expect(sent).toEqual(["alice"]);
  expect((await db.doc(`emailReminders/${alice.id}`).get()).data()!.attemptCount).toBe(2);
  expect(await Promise.all(excluded.map(userRecords))).toEqual(before);
});
test("dry run limitado a un UID no escribe datos ni consulta Auth o el proveedor", async () => {
  await seed(); await seed("bob");
  await db.doc("profiles/bob/interactions/return").set({ eventType: "LOGIN", timestamp: Timestamp.fromMillis(clock - 60_000) });
  process.env.REMINDER_ENABLED = "false"; process.env.REMINDER_DRY_RUN = "true"; process.env.REMINDER_TEST_USER_IDS = "alice";
  const before = await Promise.all([userRecords("alice"), userRecords("bob")]); let calls = 0;
  const report = await job({ account: async () => { calls++; throw Error("No Auth en dry run"); }, send: async () => { calls++; throw Error("No proveedor en dry run"); } });
  expect(report.disabled).toBe(true); expect(report.dryRun).toBe(true); expect(report.candidates).toBe(1); expect(report.accepted).toBe(0); expect(calls).toBe(0);
  expect(await Promise.all([userRecords("alice"), userRecords("bob")])).toEqual(before);
  for (const name of ["emailReminders", "unsubscribeTokens", "notificationJobs"]) expect((await db.collection(name).get()).empty).toBe(true);
});
test("el filtro conserva las 96 horas desde actividad y consentimiento, así como la exclusión de administradores", async () => {
  await seed("alice", true, 4); process.env.REMINDER_DRY_RUN = "true"; process.env.REMINDER_TEST_USER_IDS = "alice";
  await db.doc("profiles/alice").update({ "emailNotifications.consentedAt": Timestamp.fromMillis(clock - 4 * DAY + 1) });
  expect((await job()).candidates).toBe(0); // Consentimiento aún demasiado reciente.
  await db.doc("profiles/alice").update({ "emailNotifications.consentedAt": Timestamp.fromMillis(clock - 4 * DAY) });
  expect((await job()).candidates).toBe(1); // Justo 96 horas en ambas fechas.
  await db.doc("userActivity/alice").update({ lastActiveAt: Timestamp.fromMillis(clock - 4 * DAY + 1) });
  expect((await job()).candidates).toBe(0); // La última actividad todavía no cumple el umbral.
  await db.doc("userActivity/alice").update({ lastActiveAt: Timestamp.fromMillis(clock - 4 * DAY) });
  await db.doc("profiles/alice").update({ "emailNotifications.enabled": false });
  expect((await job()).candidates).toBe(0);
  await db.doc("profiles/alice").update({ "emailNotifications.enabled": true, "emailNotifications.consentedAt": null });
  expect((await job()).candidates).toBe(0); // enabled=true no sustituye una fecha de consentimiento.
  await db.doc("profiles/alice").update({ "emailNotifications.consentedAt": Timestamp.fromMillis(clock - 4 * DAY), role: "admin" });
  expect((await job()).candidates).toBe(0);
});
test("general sin lista conserva reparación de actividad, recuperación y envío de todos los elegibles", async () => {
  await seed(); await seed("bob");
  const bob = (await claimReminder(db, "bob", "cycle-1", message, clock - 20 * 60_000))!;
  await finishReminder(db, bob, { status: "uncertain", code: "timeout", message: "Prueba local" }, clock - 16 * 60_000);
  await db.doc("profiles/bob/interactions/latest").set({ eventType: "VIEW_REGULATION", timestamp: Timestamp.fromMillis(clock - 4.5 * DAY) });
  process.env.REMINDER_SEND_MODE = "general"; process.env.REMINDER_TEST_USER_IDS = "";
  const sent: string[] = [];
  const report = await job({ send: async (_message, _key, uid) => { sent.push(uid); return { status: "accepted", providerMessageId: "general-" + uid }; } });
  expect(report.accepted).toBe(2); expect(sent.sort()).toEqual(["alice", "bob"]);
  expect((await db.doc("userActivity/bob").get()).data()!.lastActiveAt.toMillis()).toBe(clock - 4.5 * DAY);
  expect((await db.doc(`emailReminders/${bob.id}`).get()).data()!.attemptCount).toBe(2);
});
test("general conserva la restricción opcional de una lista de UIDs no vacía", async () => {
  await seed(); await seed("bob"); process.env.REMINDER_SEND_MODE = "general"; process.env.REMINDER_TEST_USER_IDS = "alice";
  const sent: string[] = [];
  const report = await job({ send: async (_message, _key, uid) => { sent.push(uid); return { status: "accepted", providerMessageId: "restricted-general" }; } });
  expect(report.accepted).toBe(1); expect(sent).toEqual(["alice"]);
});
test("dos procesos solo obtienen un claim y una aceptación; no se duplica al ejecutar otra vez", async () => {
  await seed();
  const results = await Promise.all([claimReminder(db, "alice", "cycle-1", message, clock), claimReminder(db, "alice", "cycle-1", message, clock)]);
  expect(results.filter(Boolean)).toHaveLength(1); const claimed = results.find(Boolean)!;
  await finishReminder(db, claimed, { status: "accepted", providerMessageId: "provider-one" }, clock);
  let calls = 0; await job({ send: async () => { calls++; throw new Error("No duplicar"); } }); expect(calls).toBe(0);
});
test("una interrupción posterior a la aceptación recupera el mismo payload, token y clave", async () => {
  await seed(); const first = (await claimReminder(db, "alice", "cycle-1", message, clock))!;
  // Simula Resend aceptado y proceso terminado ANTES de guardar el resultado.
  clock += 6 * 60_000;
  await db.doc("profiles/alice").update({ name: "Nombre modificado", "preferences.topics": ["demand"] });
  const recovered = (await claimReminder(db, "alice", "cycle-1", { ...message, subject: "No debe reemplazar el original" }, clock))!;
  expect(recovered.record.idempotencyKey).toBe(first.record.idempotencyKey); expect(recovered.message).toEqual(first.message);
  expect(recovered.record.payloadHash).toBe(first.record.payloadHash); expect(recovered.record.attemptCount).toBe(2);
  await finishReminder(db, recovered, { status: "accepted", providerMessageId: "same-provider-id" }, clock);
  expect((await db.collection("emailReminders").doc(recovered.id).get()).data()!.status).toBe("accepted");
});
test("espera nextAttemptAt y bloquea resultados inciertos fuera de 23 h o al agotar intentos", async () => {
  await seed(); const claim = (await claimReminder(db, "alice", "cycle-1", message, clock))!;
  await finishReminder(db, claim, { status: "uncertain", code: "timeout", message: "No confirmado" }, clock);
  expect(await claimReminder(db, "alice", "cycle-1", undefined, clock + 5 * 60_000)).toBeNull();
  expect(await claimReminder(db, "alice", "cycle-1", undefined, clock + DAY)).toBeNull();
  expect((await db.doc(`emailReminders/${claim.id}`).get()).data()!.status).toBe("needs_review");
});
test("los reintentos son limitados y las escrituras de workers antiguos no pisan la recuperación", async () => {
  await seed(); const first = (await claimReminder(db, "alice", "cycle-1", message, clock))!;
  const second = (await claimReminder(db, "alice", "cycle-1", undefined, clock + 6 * 60_000))!;
  await finishReminder(db, first, { status: "permanent", code: "old", message: "Viejo" }, clock + 6 * 60_000);
  expect((await db.doc(`emailReminders/${first.id}`).get()).data()!.leaseId).toBe(second.leaseId);
  await finishReminder(db, second, { status: "retryable", code: "429", message: "Reintentar" }, clock + 6 * 60_000);
  const third = (await claimReminder(db, "alice", "cycle-1", undefined, clock + 67 * 60_000))!;
  await finishReminder(db, third, { status: "uncertain", code: "timeout", message: "No confirmado" }, clock + 67 * 60_000);
  expect((await db.doc(`emailReminders/${first.id}`).get()).data()!.status).toBe("needs_review");
});
test("revocar el consentimiento o regresar cancela el envío antes de llamar al proveedor", async () => {
  await seed(); const first = (await claimReminder(db, "alice", "cycle-1", message, clock))!;
  await setEmailConsent("alice", false, "profile", db);
  expect(await authorizeSend(db, first, message.to[0]!, clock)).toBe(false);
  await seed("bob"); const bob = (await claimReminder(db, "bob", "cycle-1", message, clock))!;
  await touchActivity("bob", "session_resume", db, clock);
  expect(await authorizeSend(db, bob, message.to[0]!, clock)).toBe(false);
});
test("un evento confirmado reciente impide recordatorios aunque se perdiera el toque HTTP", async () => {
  await seed(); await db.doc("profiles/alice/interactions/return").set({ timestamp: Timestamp.fromMillis(clock - 60_000), eventType: "VIEW_DASHBOARD" });
  let calls = 0; const report = await job({ send: async () => { calls++; throw new Error("Regresó"); } });
  expect(report.candidates).toBe(0); expect(calls).toBe(0);
});
test("baja de uso único, expirada o alterada no cambia otros usuarios", async () => {
  await seed(); await seed("bob"); const claimed = (await claimReminder(db, "alice", "cycle-1", message, clock))!;
  const token = unsubscribeToken(claimed.id);
  const stored = (await db.doc(`unsubscribeTokens/${tokenHash(token)}`).get()).data()!;
  expect(stored.token).toBeUndefined(); expect(stored.userId).toBe("alice");
  expect(await unsubscribeWithToken(token + "x", db, clock)).toBe(false);
  expect(await unsubscribeWithToken(token, db, clock + 46 * DAY)).toBe(false);
  expect(await unsubscribeWithToken(token, db, clock)).toBe(true);
  expect(await unsubscribeWithToken(token, db, clock)).toBe(false);
  expect((await db.doc("profiles/alice").get()).data()!.emailNotifications.enabled).toBe(false);
  expect((await db.doc("profiles/bob").get()).data()!.emailNotifications.enabled).toBe(true);
});
test("un nuevo ciclo respeta el límite de siete días entre aceptaciones", async () => {
  await seed(); const first = (await claimReminder(db, "alice", "cycle-1", message, clock))!;
  await finishReminder(db, first, { status: "accepted", providerMessageId: "one" }, clock);
  await touchActivity("alice", "session_resume", db, clock + DAY);
  const activity = (await db.doc("userActivity/alice").get()).data()!;
  expect(await claimReminder(db, "alice", activity.cycleId, message, clock + 5 * DAY)).toBeNull();
  expect(await claimReminder(db, "alice", activity.cycleId, message, clock + 8 * DAY)).not.toBeNull();
});
test("paginación avanza más allá de usuarios ya notificados y conserva el mensaje cifrado", async () => {
  await seed(); await seed("bob"); process.env.REMINDER_BATCH_SIZE = "1";
  const first = (await claimReminder(db, "alice", "cycle-1", message, clock))!;
  await finishReminder(db, first, { status: "accepted", providerMessageId: "a" }, clock);
  const report = await job({ send: async () => ({ status: "accepted", providerMessageId: "b" }) });
  expect(report.accepted).toBe(1);
  const bob = (await db.doc(`emailReminders/${reminderId("bob", "cycle-1")}`).get()).data()!;
  expect(JSON.stringify(bob.envelope)).not.toContain(message.to[0]!);
  expect(openEmail(bob.envelope).to[0]).toBe(message.to[0]);
});

function gmailFixture() {
  // Cuenta, contraseña y transporte sintéticos. Ninguna prueba se conecta a Gmail.
  Object.assign(process.env, { EMAIL_PROVIDER: "gmail_smtp", SMTP_USER: "fixture@gmail.com", SMTP_APP_PASSWORD: "abcdefghijklmnop", EMAIL_FROM: "Visual Community <fixture@gmail.com>" });
  return { ...message, from: process.env.EMAIL_FROM! };
}

test("SMTP dry run y UID permitido conservan aislamiento sin reservar cuota ni abrir transporte", async () => {
  gmailFixture(); await seed(); await seed("bob");
  await db.doc("profiles/bob/interactions/recent").set({ timestamp: Timestamp.fromMillis(clock - 60_000), eventType: "LOGIN" });
  const before = await Promise.all([userRecords("alice"), userRecords("bob")]);
  process.env.REMINDER_DRY_RUN = "true"; process.env.REMINDER_ENABLED = "false"; process.env.REMINDER_TEST_USER_IDS = "alice";
  let calls = 0;
  const report = await job({ send: async () => { calls++; throw Error("No SMTP"); }, account: async () => { calls++; throw Error("No Auth"); } });
  expect(report.candidates).toBe(1); expect(report.accepted).toBe(0); expect(calls).toBe(0);
  expect(await Promise.all([userRecords("alice"), userRecords("bob")])).toEqual(before);
  expect((await db.collection("notificationJobs").get()).empty).toBe(true);
  expect((await db.collection("emailReminders").get()).empty).toBe(true);
});

test("SMTP reserva una sola transmisión por lease incluso con llamadas concurrentes", async () => {
  const mail = gmailFixture(); await seed();
  const claims = await Promise.all([claimReminder(db, "alice", "cycle-1", mail, clock), claimReminder(db, "alice", "cycle-1", mail, clock)]);
  expect(claims.filter(Boolean)).toHaveLength(1); const claim = claims.find(Boolean)!;
  const dispatches = await Promise.all([beginReminderDispatch(db, claim, mail.to[0]!, clock), beginReminderDispatch(db, claim, mail.to[0]!, clock)]);
  expect(dispatches.map(value => value.status).sort()).toEqual(["blocked", "ready"]);
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).data()!.dispatches).toHaveLength(1);
}, 20000); // Dos rondas de transacciones en conflicto incluyen el backoff real del SDK.

test("SMTP no recupera automáticamente una transmisión interrumpida después de reservar el cupo", async () => {
  const mail = gmailFixture(); await seed();
  const claim = (await claimReminder(db, "alice", "cycle-1", mail, clock))!;
  expect((await beginReminderDispatch(db, claim, mail.to[0]!, clock)).status).toBe("ready");
  // Equivale a aceptación SMTP seguida de caída ANTES de guardar el resultado.
  clock += 6 * 60_000; let calls = 0;
  const report = await job({ send: async () => { calls++; throw Error("No reenviar"); } });
  expect(calls).toBe(0); expect(report.needsReview).toBe(1);
  expect((await db.doc(`emailReminders/${claim.id}`).get()).data()!.status).toBe("needs_review");
  expect((await db.doc(`emailReminders/${claim.id}`).get()).data()!.attemptCount).toBe(1);
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).data()!.dispatches).toHaveLength(1);
});

test("SMTP recupera un claim interrumpido antes de iniciar transmisión", async () => {
  const mail = gmailFixture(); await seed();
  const claim = (await claimReminder(db, "alice", "cycle-1", mail, clock))!; clock += 6 * 60_000;
  let calls = 0;
  const report = await job({ send: async (frozen, _key, uid, context) => { calls++; expect(uid).toBe("alice"); expect(frozen).toEqual(mail); expect(context.messageId).toBe(claim.record.messageId); return { status: "accepted", messageId: context.messageId }; } });
  expect(report.accepted).toBe(1); expect(calls).toBe(1);
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).data()!.dispatches).toHaveLength(1);
});

test("SMTP incierto pasa a revisión y mantiene el consumo del cupo sin repetir llamadas", async () => {
  gmailFixture(); await seed(); let calls = 0;
  const send = async () => { calls++; return { status: "uncertain" as const, code: "smtp_timeout", message: "No confirmado" }; };
  const first = await job({ send }); expect(first.needsReview).toBe(1);
  clock += DAY + 1; await job({ send }); expect(calls).toBe(1);
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).data()!.dispatches).toHaveLength(1);
});

test("SMTP reintenta rechazo temporal al día siguiente con la misma copia y ventana de 72 horas", async () => {
  gmailFixture(); await seed(); let calls = 0; let originalMail: FrozenEmail | undefined; let originalId: string | undefined;
  const send: NonNullable<Parameters<typeof job>[0]>["send"] = async (mail, _key, _uid, context) => {
    calls++;
    if (calls === 1) { originalMail = mail; originalId = context.messageId; return { status: "retryable", code: "smtp_451", message: "Rechazo temporal confirmado" }; }
    expect(mail).toEqual(originalMail!); expect(context.messageId).toBe(originalId!); return { status: "accepted", messageId: context.messageId };
  };
  expect((await job({ send })).deferred).toBe(1);
  const ref = db.doc(`emailReminders/${reminderId("alice", "cycle-1")}`);
  const pending = (await ref.get()).data()!;
  expect(pending.retryDeadlineAt.toMillis() - pending.firstRequestAt.toMillis()).toBe(3 * DAY);
  expect(pending.nextAttemptAt.toMillis()).toBe(clock + DAY);
  await db.doc("profiles/alice").update({ name: "Nombre distinto", "preferences.topics": ["energy_communities"] });
  clock += DAY - 1; expect((await job({ send })).accepted).toBe(0); expect(calls).toBe(1);
  clock += 2; expect((await job({ send })).accepted).toBe(1); expect(calls).toBe(2);
  expect((await ref.get()).data()!.attemptCount).toBe(2);
  clock += DAY; expect((await job({ send })).accepted).toBe(0); expect(calls).toBe(2);
});

test("SMTP limita rechazos temporales a tres intentos y no reabre mensajes vencidos", async () => {
  gmailFixture(); await seed(); let calls = 0;
  const send = async () => { calls++; return { status: "retryable" as const, code: "smtp_451", message: "Rechazo temporal confirmado" }; };
  await job({ send }); clock += DAY; await job({ send }); clock += DAY;
  expect((await job({ send })).needsReview).toBe(1); clock += DAY; await job({ send }); expect(calls).toBe(3);
  const mail = { ...message, from: process.env.EMAIL_FROM! }; await seed("bob");
  const expired = (await claimReminder(db, "bob", "cycle-1", mail, clock))!;
  clock += 3 * DAY + 1; await job({ send }); expect(calls).toBe(3);
  expect((await db.doc(`emailReminders/${expired.id}`).get()).data()!.status).toBe("needs_review");
});

test("SMTP permite como máximo 20 intentos cada 24 horas incluso entre ejecuciones", async () => {
  gmailFixture(); process.env.REMINDER_SEND_MODE = "general"; process.env.REMINDER_TEST_USER_IDS = "";
  for (let i = 0; i < 21; i++) await seed("smtp-" + String(i).padStart(2, "0"));
  let calls = 0;
  const send = async () => { calls++; return { status: "accepted" as const, messageId: "local-correlation" }; };
  const first = await job({ send }); expect(first.accepted).toBe(20); expect(first.budgetLimited).toBe(true); expect(calls).toBe(20);
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).data()!.dispatches).toHaveLength(20);
  expect((await job({ send })).accepted).toBe(0); expect(calls).toBe(20);
  const deferred = db.doc(`emailReminders/${reminderId("smtp-20", "cycle-1")}`);
  expect((await deferred.get()).data()!.attemptCount).toBe(0); // No consume intentos de recuperación sin transmitir.
  clock += DAY + 1; expect((await job({ send })).accepted).toBe(1); expect(calls).toBe(21);
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).data()!.dispatches).toHaveLength(1);
}, 30000);

test("SMTP dos usuarios concurrentes compiten por el último cupo sin exceder 20", async () => {
  const mail = gmailFixture(); await seed(); await seed("bob");
  await db.doc("notificationJobs/gmailSmtpUsage").set({ dispatches: Array.from({ length: 19 }, () => Timestamp.fromMillis(clock - 60_000)) });
  const alice = (await claimReminder(db, "alice", "cycle-1", mail, clock))!; const bob = (await claimReminder(db, "bob", "cycle-1", mail, clock))!;
  const result = await Promise.all([beginReminderDispatch(db, alice, mail.to[0]!, clock), beginReminderDispatch(db, bob, mail.to[0]!, clock)]);
  expect(result.map(value => value.status).sort()).toEqual(["budget_exhausted", "ready"]);
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).data()!.dispatches).toHaveLength(20);
}, 20000);

test("SMTP un resultado incierto también ocupa el vigésimo cupo y bloquea al siguiente usuario", async () => {
  gmailFixture(); await seed(); await seed("bob");
  await db.doc("notificationJobs/gmailSmtpUsage").set({ dispatches: Array.from({ length: 19 }, () => Timestamp.fromMillis(clock - 60_000)) });
  let calls = 0;
  const send = async () => { calls++; return { status: "uncertain" as const, code: "smtp_timeout", message: "No confirmado" }; };
  expect((await job({ send })).needsReview).toBe(1);
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).data()!.dispatches).toHaveLength(20);
  expect((await job({ send })).budgetLimited).toBe(true); expect(calls).toBe(1);
});

test("SMTP revocación, promoción a admin y dry run bloquean transmisión y reserva", async () => {
  const mail = gmailFixture(); await seed(); await seed("bob");
  const alice = (await claimReminder(db, "alice", "cycle-1", mail, clock))!; const bob = (await claimReminder(db, "bob", "cycle-1", mail, clock))!;
  await setEmailConsent("alice", false, "profile", db); await db.doc("profiles/bob").update({ role: "admin" });
  expect((await beginReminderDispatch(db, alice, mail.to[0]!, clock)).status).toBe("blocked");
  expect((await beginReminderDispatch(db, bob, mail.to[0]!, clock)).status).toBe("blocked");
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).exists).toBe(false);
  process.env.REMINDER_DRY_RUN = "true";
  const before = await userRecords("alice"); expect((await beginReminderDispatch(db, alice, mail.to[0]!, clock)).status).toBe("blocked"); expect(await userRecords("alice")).toEqual(before);
});

test("SMTP detiene el lote ante error de cuenta sin probar otros destinatarios", async () => {
  gmailFixture(); await seed(); await seed("bob"); let calls = 0;
  const report = await job({ send: async () => { calls++; return { status: "account_error", code: "smtp_auth", message: "Revisar autenticación" }; } });
  expect(report.failures).toBe(1); expect(calls).toBe(1);
  expect((await db.collection("emailReminders").get()).size).toBe(1);
  expect((await db.doc("notificationJobs/gmailSmtpUsage").get()).data()!.dispatches).toHaveLength(1);
});

test("cambiar a Gmail no reenvía un registro antiguo sin proveedor ni altera aceptados de Resend", async () => {
  await seed(); await seed("bob");
  const pending = (await claimReminder(db, "alice", "cycle-1", message, clock))!;
  // Reproduce un documento legacy anterior al campo provider.
  const legacy = { ...(await db.doc(`emailReminders/${pending.id}`).get()).data()! }; delete legacy.provider;
  await db.doc(`emailReminders/${pending.id}`).set(legacy);
  const accepted = (await claimReminder(db, "bob", "cycle-1", message, clock))!; await finishReminder(db, accepted, { status: "accepted", providerMessageId: "resend-fixture" }, clock);
  const before = await userRecords("bob"); gmailFixture(); clock += 6 * 60_000; let calls = 0;
  const report = await job({ send: async () => { calls++; throw Error("No cambiar proveedor"); } });
  expect(calls).toBe(0); expect(report.needsReview).toBe(1); expect(await userRecords("bob")).toEqual(before);
  expect((await db.doc(`emailReminders/${pending.id}`).get()).data()!.reason).toBe("provider_changed");
});

test("SMTP no reenvía sobres que no se pueden descifrar", async () => {
  const mail = gmailFixture(); await seed();
  const claim = (await claimReminder(db, "alice", "cycle-1", mail, clock))!; clock += 6 * 60_000;
  process.env.NOTIFICATION_TOKEN_SECRET = "different-fixture-".repeat(3); let calls = 0;
  const report = await job({ send: async () => { calls++; throw Error("No SMTP"); } });
  expect(report.needsReview).toBe(1); expect(calls).toBe(0);
  expect((await db.doc(`emailReminders/${claim.id}`).get()).data()!.reason).toBe("payload_or_secret_changed");
});
