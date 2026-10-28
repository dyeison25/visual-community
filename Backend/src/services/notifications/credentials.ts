import { createPrivateKey } from "node:crypto";
import { notificationSecret, reminderSettings, requiredEmailSettings } from "./config";

type ConfigurationCode = "firebase_credentials_missing" | "firebase_private_key_invalid" | "notification_secret_invalid" | "email_configuration_invalid";
export class ReminderConfigurationError extends Error {
  constructor(readonly code: ConfigurationCode) { super("La configuración privada de recordatorios no es válida."); }
}

/** Validación local en Actions ANTES de consultar/escribir Firestore. Nunca devuelve secretos ni abre SMTP. */
export function validateReminderCredentials(env: NodeJS.ProcessEnv = process.env) {
  if (!env.FIREBASE_PROJECT_ID?.trim() || !env.FIREBASE_CLIENT_EMAIL?.trim() || !env.FIREBASE_PRIVATE_KEY?.trim()) {
    throw new ReminderConfigurationError("firebase_credentials_missing");
  }
  try {
    // Mismo tratamiento que firebase.config.ts: saltos reales o \n escapados, sin imprimir el PEM.
    const key = createPrivateKey(env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"));
    if (key.asymmetricKeyType !== "rsa") throw new Error();
  } catch { throw new ReminderConfigurationError("firebase_private_key_invalid"); }
  // Este secreto se conserva como texto: no se expande, decodifica ni rota.
  try { notificationSecret(env); } catch { throw new ReminderConfigurationError("notification_secret_invalid"); }
  if (!reminderSettings(env).dryRun) {
    try { requiredEmailSettings(env); } catch { throw new ReminderConfigurationError("email_configuration_invalid"); }
  }
}
