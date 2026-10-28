import type { EmailProvider } from "./types";

export const SMTP_DAILY_ATTEMPT_LIMIT = 20;
export const SMTP_RETRY_WINDOW_MS = 72 * 60 * 60_000;

/** Ausencia de proveedor conserva el comportamiento de despliegues anteriores. */
export function emailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const provider = env.EMAIL_PROVIDER?.trim() || "resend";
  if (provider !== "resend" && provider !== "gmail_smtp") throw new Error("EMAIL_PROVIDER no es válido.");
  return provider;
}

/** Configuración leída bajo demanda: el servidor web puede funcionar con recordatorios desactivados. */
export function reminderSettings(env: NodeJS.ProcessEnv = process.env) {
  const inactivityDays = Number(env.REMINDER_INACTIVITY_DAYS || "4");
  const maxAttempts = Number(env.REMINDER_MAX_ATTEMPTS || "3");
  const batchSize = Number(env.REMINDER_BATCH_SIZE || "50");
  return {
    enabled: env.REMINDER_ENABLED === "true",
    // Ausencia de configuración significa simulación, incluso si se habilita el job.
    dryRun: env.REMINDER_DRY_RUN !== "false",
    sendMode: env.REMINDER_SEND_MODE === "general" ? "general" as const : "test" as const,
    inactivityMs: (Number.isFinite(inactivityDays) && inactivityDays >= 1 ? inactivityDays : 4) * 86_400_000,
    maxAttempts: Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 5 ? maxAttempts : 3,
    batchSize: Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= 200 ? batchSize : 50,
    testUserIds: new Set((env.REMINDER_TEST_USER_IDS || "").split(",").map(value => value.trim()).filter(Boolean)),
    cooldownMs: 7 * 86_400_000,
    maxPages: 10,
  };
}

export function frontendUrl(env: NodeJS.ProcessEnv = process.env) {
  const value = env.FRONTEND_URL?.trim() || (env.NODE_ENV !== "production" ? "http://localhost:5173" : "");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("FRONTEND_URL debe contener un origen HTTP(S) válido."); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || (env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("FRONTEND_URL debe ser un origen HTTP(S); en producción se requiere HTTPS.");
  return url;
}

export function notificationSecret(env: NodeJS.ProcessEnv = process.env) {
  const value = env.NOTIFICATION_TOKEN_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("NOTIFICATION_TOKEN_SECRET debe tener al menos 32 caracteres aleatorios.");
  return value;
}

export function requiredEmailSettings(env: NodeJS.ProcessEnv = process.env) {
  const provider = emailProvider(env);
  const from = env.EMAIL_FROM?.trim();
  const secret = notificationSecret(env);
  if (!from || /[\r\n]/.test(from)) {
    throw new Error("Faltan variables privadas para enviar recordatorios por correo.");
  }
  if (provider === "resend") {
    const apiKey = env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("Falta la configuración privada de Resend.");
    return { provider, apiKey, from, secret };
  }
  const user = env.SMTP_USER?.trim().toLowerCase();
  const pass = env.SMTP_APP_PASSWORD?.replace(/\s/g, "");
  if (!user || !/^[^\s<>@]+@(gmail|googlemail)\.com$/.test(user) || !pass || !/^[a-zA-Z0-9]{16}$/.test(pass) || senderAddress(from) !== user) {
    throw new Error("Revisa la cuenta Gmail, la contraseña de aplicación y el remitente. No uses la contraseña normal de Google.");
  }
  return { provider, user, pass, from, secret };
}

export function senderAddress(from: string) {
  const match = /^(?:[^<>\r\n]+<([^<>\s]+)>|([^<>\s]+))$/.exec(from.trim());
  return (match?.[1] || match?.[2] || "").toLowerCase();
}
