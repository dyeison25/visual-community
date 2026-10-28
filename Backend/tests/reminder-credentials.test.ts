import { expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { ReminderConfigurationError, validateReminderCredentials } from "../src/services/notifications/credentials";
import { notificationSecret } from "../src/services/notifications/config";

// Clave efímera sintética, jamás guardada ni enviada a Google.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const fixture = { FIREBASE_PROJECT_ID: "fixture", FIREBASE_CLIENT_EMAIL: "fixture@example.invalid", FIREBASE_PRIVATE_KEY: privateKey,
  NOTIFICATION_TOKEN_SECRET: "fixture-stable-secret-".repeat(3), REMINDER_DRY_RUN: "true" };

function code(env: NodeJS.ProcessEnv) {
  try { validateReminderCredentials(env); return "valid"; }
  catch (error) {
    if (!(error instanceof ReminderConfigurationError)) throw Error("Error no controlado");
    expect(error.message).toBe("La configuración privada de recordatorios no es válida.");
    return error.code;
  }
}

test("preflight interpreta saltos reales, CRLF y \\n escapados de Firebase sin mostrar el PEM", () => {
  for (const key of [privateKey, privateKey.replace(/\n/g, "\\n"), privateKey.replace(/\n/g, "\r\n")]) expect(code({ ...fixture, FIREBASE_PRIVATE_KEY: key })).toBe("valid");
});

test("preflight falla cerrado con credenciales Firebase ausentes o inválidas", () => {
  for (const field of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]) expect(code({ ...fixture, [field]: "" })).toBe("firebase_credentials_missing");
  expect(code({ ...fixture, FIREBASE_PRIVATE_KEY: "invalid-synthetic-private-content" })).toBe("firebase_private_key_invalid");
});

test("el secreto de notificaciones se mantiene como texto estable y se exige antes del job", () => {
  const secret = "fixture-literal\\n-value-".repeat(3);
  expect(notificationSecret({ NOTIFICATION_TOKEN_SECRET: " " + secret + " " })).toBe(secret);
  expect(code({ ...fixture, NOTIFICATION_TOKEN_SECRET: "" })).toBe("notification_secret_invalid");
  expect(code({ ...fixture, NOTIFICATION_TOKEN_SECRET: "short" })).toBe("notification_secret_invalid");
});

test("un envío real exige configuración Gmail antes de cualquier consulta o transmisión", () => {
  expect(code({ ...fixture, EMAIL_PROVIDER: "gmail_smtp", REMINDER_DRY_RUN: "false" })).toBe("email_configuration_invalid");
  expect(code({ ...fixture, EMAIL_PROVIDER: "gmail_smtp", REMINDER_DRY_RUN: "false", EMAIL_FROM: "fixture@gmail.com", SMTP_USER: "fixture@gmail.com", SMTP_APP_PASSWORD: "abcdefghijklmnop" })).toBe("valid");
});
