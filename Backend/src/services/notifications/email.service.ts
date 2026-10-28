import { frontendUrl, requiredEmailSettings, reminderSettings, emailProvider } from "./config";
import type { DispatchContext, FrozenEmail, ProviderResult } from "./types";
import { createResendTransport } from "./transports/resend.transport";
import { createGmailSmtpTransport } from "./transports/gmail-smtp.transport";

/** Segunda barrera: desactivado o dry-run nunca hace peticiones al proveedor. */
export async function sendReminderEmail(message: FrozenEmail, key: string, userId: string, context?: DispatchContext): Promise<ProviderResult> {
  const settings = reminderSettings();
  if (settings.dryRun) return { status: "simulated" };
  if (!settings.enabled || (settings.sendMode === "test" && !settings.testUserIds.has(userId))) return { status: "disabled" };
  if (context && context.provider !== emailProvider()) return { status: "account_error", code: "provider_changed", message: "El proveedor del mensaje no coincide con el configurado." };
  const credentials = requiredEmailSettings();
  const transport = credentials.provider === "resend" ? createResendTransport(credentials.apiKey) : createGmailSmtpTransport(credentials.user, credentials.pass);
  return transport.send(message, key, context);
}

export function unsubscribeUrl(token: string, origin = frontendUrl().origin) {
  const url = new URL("/notificaciones/baja", origin); url.hash = "t=" + encodeURIComponent(token); return url.toString();
}
