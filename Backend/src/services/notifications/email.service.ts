import { frontendUrl, requiredEmailSettings, reminderSettings } from "./config";
import type { FrozenEmail, ProviderResult } from "./types";

/** Segunda barrera: desactivado o dry-run nunca hace peticiones al proveedor. */
export async function sendReminderEmail(message: FrozenEmail, key: string, userId: string): Promise<ProviderResult> {
  const settings = reminderSettings();
  if (settings.dryRun) return { status: "simulated" };
  if (!settings.enabled || (settings.sendMode === "test" && !settings.testUserIds.has(userId))) return { status: "disabled" };
  const { apiKey } = requiredEmailSettings();
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await response.json().catch(() => ({})) as { id?: unknown; name?: unknown };
    if (response.ok && typeof body.id === "string" && body.id) return { status: "accepted", providerMessageId: body.id };
    // Un 2xx sin id, un 5xx o un timeout no demuestran que el proveedor no aceptó el mensaje.
    if (response.ok || response.status >= 500) return { status: "uncertain", code: String(response.status), message: "El resultado del proveedor requiere recuperación con la misma clave." };
    if (response.status === 429 || (response.status === 409 && body.name === "concurrent_idempotent_requests")) return { status: "retryable", code: String(response.status), message: "El proveedor solicita reintentar más tarde." };
    return { status: "permanent", code: String(response.status), message: "El proveedor rechazó la solicitud; revisar remitente, permisos o parámetros." };
  } catch {
    return { status: "uncertain", code: "network_or_timeout", message: "No se confirmó el resultado del proveedor." };
  }
}

export function unsubscribeUrl(token: string, origin = frontendUrl().origin) {
  const url = new URL("/notificaciones/baja", origin); url.hash = "t=" + encodeURIComponent(token); return url.toString();
}
