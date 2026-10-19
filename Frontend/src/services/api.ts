import { auth } from "../config/firebase";
/**
 * Consulta una ruta de nuestro backend y adjunta el ID token de Firebase para identificar al usuario.
 * Limita la espera HTTP a 28 segundos y admite cancelación al abandonar una pantalla.
 * Si el backend rechaza la sesión con 401, la cierra; otros fallos se convierten en mensajes claros.
 */
export async function apiRequest(path: string, signal?: AbortSignal): Promise<unknown> {
  const user = auth?.currentUser;
  if (!user) throw new Error("Inicia sesión para consultar esta información.");
  const token = await user.getIdToken();
  const timeout = path === "/energy/map" ? 90000 : 28000;
  const combined = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
  const response = await fetch((import.meta.env.VITE_API_BASE_URL || "/api") + path, {
    signal: combined, headers: { Authorization: "Bearer " + token, Accept: "application/json" },
  });
  if (response.status === 401) { await auth?.signOut(); throw new Error("Tu sesión venció. Inicia sesión nuevamente."); }
  if (response.status === 403) throw new Error("No tienes permisos para consultar esta sección.");
  if (response.status === 429) throw new Error("Espera un minuto antes de volver a consultar.");
  if (!response.ok) throw new Error("No pudimos cargar esta información. Intenta de nuevo.");
  return response.json();
}
/**
 * Usa apiRequest y comprueba la forma básica de las respuestas sobre fuentes oficiales:
 * deben contener data (datos), status (estado) y source (origen).
 * Esta comprobación no valida por sí sola todos los campos internos del contenido.
 */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const data = await apiRequest(path, signal);
  if (!data || typeof data !== "object" || !("data" in data) || !("status" in data) || !("source" in data)) throw new Error("La información recibida no está disponible.");
  return data as T;
}
