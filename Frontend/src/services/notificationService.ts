import { auth } from "../config/firebase";

const baseUrl = () => import.meta.env.VITE_API_BASE_URL || "/api";
async function jsonRequest(path: string, body: unknown, authenticated: boolean) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (authenticated) {
    const user = auth?.currentUser;
    if (!user) throw new Error("Inicia sesión para actualizar esta preferencia.");
    headers.Authorization = "Bearer " + await user.getIdToken();
  }
  const response = await fetch(baseUrl() + path, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const data = await response.json().catch(() => null) as { message?: unknown } | null;
  if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "No pudimos completar la solicitud.");
  return data;
}

export const notificationService = {
  setConsent: (enabled: boolean, origin: "onboarding" | "profile") => jsonRequest("/notifications/consent", { enabled, origin }, true),
  unsubscribe: (token: string) => jsonRequest("/notifications/unsubscribe", { token, confirm: true }, false),
};
