import { expect, test } from "bun:test";
import { reminderSettings } from "../src/services/notifications/config";
import { isOpaqueToken, tokenHash, unsubscribeToken } from "../src/services/notifications/unsubscribe.service";
import { sendReminderEmail } from "../src/services/notifications/email.service";
import { openEmail, sealEmail, payloadHash } from "../src/services/notifications/envelope";
import { frontendUrl } from "../src/services/notifications/config";
import type { FrozenEmail } from "../src/services/notifications/types";
import { personalizedReminder } from "../src/services/notifications/personalization.service";

const message: FrozenEmail = { from: "test@example.invalid", to: ["recipient@example.invalid"], subject: "x", html: "<p>Opaque-token-test</p>", text: "x", tags: [] };

test("el token de baja es opaco, estable por recordatorio y no contiene el uid", () => {
  const secret = "x".repeat(32); const token = unsubscribeToken("uid_cycle_inactive_4d", secret);
  expect(isOpaqueToken(token)).toBe(true);
  expect(token).not.toContain("uid");
  expect(tokenHash(token)).toHaveLength(64);
  expect(unsubscribeToken("uid_cycle_inactive_4d", secret)).toBe(token);
  expect(unsubscribeToken("otro", secret)).not.toBe(token);
});
test("modo seco y envío desactivado no pueden contactar a Resend", async () => {
  const previous = { enabled: process.env.REMINDER_ENABLED, dry: process.env.REMINDER_DRY_RUN };
  const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error("No debe invocarse"); }) as typeof fetch;
  try {
    process.env.REMINDER_ENABLED = "false"; process.env.REMINDER_DRY_RUN = "false";
    expect((await sendReminderEmail(message, "test", "test-user")).status).toBe("disabled");
    process.env.REMINDER_ENABLED = "true"; process.env.REMINDER_DRY_RUN = "true";
    expect((await sendReminderEmail(message, "test", "test-user")).status).toBe("simulated");
    expect(calls).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.enabled === undefined) delete process.env.REMINDER_ENABLED; else process.env.REMINDER_ENABLED = previous.enabled;
    if (previous.dry === undefined) delete process.env.REMINDER_DRY_RUN; else process.env.REMINDER_DRY_RUN = previous.dry;
  }
});
test("la configuración limita intentos y destinatarios de prueba", () => {
  const settings = reminderSettings({ REMINDER_MAX_ATTEMPTS: "99", REMINDER_BATCH_SIZE: "1000", REMINDER_TEST_USER_IDS: "a, b,," });
  expect(settings.maxAttempts).toBe(3); expect(settings.batchSize).toBe(50); expect([...settings.testUserIds]).toEqual(["a", "b"]);
  expect(reminderSettings({}).dryRun).toBe(true); expect(reminderSettings({}).enabled).toBe(false); expect(reminderSettings({}).sendMode).toBe("test");
  expect(reminderSettings({ REMINDER_SEND_MODE: "live" }).sendMode).toBe("general");
  expect(reminderSettings({ REMINDER_SEND_MODE: "general" }).sendMode).toBe("general");
  expect(reminderSettings({ REMINDER_SEND_MODE: "liv" }).sendMode).toBe("test");
});
test("la copia de recuperación no guarda destinatario ni enlace en claro y detecta alteraciones", () => {
  const secret = "test-secret-".repeat(4); const envelope = sealEmail(message, secret);
  expect(JSON.stringify(envelope)).not.toContain(message.to[0]!);
  expect(JSON.stringify(envelope)).not.toContain("Opaque-token-test");
  expect(openEmail(envelope, secret)).toEqual(message);
  expect(payloadHash(openEmail(envelope, secret))).toBe(payloadHash(message));
  expect(() => openEmail(envelope, "different-secret")).toThrow();
  expect(() => openEmail({ ...envelope, ciphertext: "abc" }, secret)).toThrow();
});
test("el enlace central requiere HTTPS y un origen único en producción", () => {
  expect(frontendUrl({ NODE_ENV: "production", FRONTEND_URL: "https://sistemagestionpermanencia.web.app" }).origin).toBe("https://sistemagestionpermanencia.web.app");
  for (const value of ["", "http://example.org", "https://example.org/path", "https://user:secret@example.org", "https://example.org?token=x"]) {
    expect(() => frontendUrl({ NODE_ENV: "production", FRONTEND_URL: value })).toThrow();
  }
});
test("la personalización usa preferencias o eventos reales y no inventa actividad ni lugares", () => {
  const profile = { userId: "test", name: "Prueba", interests: [], preferences: { compactMetrics: false, topics: ["energy_communities"] } };
  const declared = personalizedReminder(profile);
  expect(new URL(declared.url).pathname).toBe("/buscar"); expect(new URL(declared.url).searchParams.get("category")).toBe("energy_communities");
  const observed = personalizedReminder(profile, Array.from({ length: 4 }, () => ({ eventType: "VIEW_REGULATION" })));
  expect(observed.topic).toBe("regulation");
  const generic = personalizedReminder({ ...profile, preferences: { compactMetrics: false, topics: [] } });
  expect(new URL(generic.url).pathname).toBe("/"); expect(generic.intro).not.toContain("elegiste"); expect(generic.intro).not.toContain("Antioquia");
});
test("Resend conserva la clave, el cuerpo y clasifica resultados inciertos sin exponer errores", async () => {
  const keys = ["REMINDER_ENABLED", "REMINDER_DRY_RUN", "REMINDER_SEND_MODE", "REMINDER_TEST_USER_IDS", "RESEND_API_KEY", "EMAIL_FROM", "NOTIFICATION_TOKEN_SECRET"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]])); const original = globalThis.fetch;
  let calls = 0; const statuses = [200, 429, 503, 401, 409, 200];
  try {
    Object.assign(process.env, { REMINDER_ENABLED: "true", REMINDER_DRY_RUN: "false", REMINDER_SEND_MODE: "test", REMINDER_TEST_USER_IDS: "allowed", RESEND_API_KEY: "fixture", EMAIL_FROM: "fixture@example.invalid", NOTIFICATION_TOKEN_SECRET: "x".repeat(40) });
    globalThis.fetch = (async (_url, init) => {
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("stable-key");
      expect(init?.body).toBe(JSON.stringify(message));
      const status = statuses[calls++]!;
      return new Response(JSON.stringify(calls === 1 ? { id: "provider-id" } : calls === 5 ? { name: "concurrent_idempotent_requests" } : {}), { status });
    }) as typeof fetch;
    expect((await sendReminderEmail(message, "stable-key", "not-allowed")).status).toBe("disabled"); expect(calls).toBe(0);
    for (const status of ["accepted", "retryable", "uncertain", "permanent", "retryable", "uncertain"]) expect((await sendReminderEmail(message, "stable-key", "allowed")).status).toBe(status);
    globalThis.fetch = (async () => { throw new Error("private-key-must-not-leak"); }) as typeof fetch;
    const result = await sendReminderEmail(message, "stable-key", "allowed");
    expect(result.status).toBe("uncertain"); expect(JSON.stringify(result)).not.toContain("private-key");
  } finally {
    globalThis.fetch = original;
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});
