export type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
/**
 * Comprueba que un dato externo sea un objeto antes de leer sus campos.
 * Rechaza valores vacíos, listas y otros tipos con un error de formato.
 */
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Formato externo inesperado");
  return value as Record<string, unknown>;
}
/**
 * Realiza la petición HTTP que utilizan los servicios de XM y MinEnergía.
 * Recibe la URL y opciones como GET o POST; devuelve el JSON recibido.
 * Aborta la espera al superar el tiempo configurado (12 segundos por defecto).
 * Rechaza errores HTTP, contenido que no sea JSON y errores declarados por la fuente.
 */
export async function fetchJson(url: string | URL, init: RequestInit = {}, fetcher: Fetcher = fetch): Promise<unknown> {
  const timeout = Math.min(30000, Math.max(1000, Number(process.env.EXTERNAL_TIMEOUT_MS) || 12000));
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(timeout), headers: { Accept: "application/json", ...init.headers } });
  if (!response.ok) throw new Error("Fuente externa no disponible");
  if (!response.headers.get("content-type")?.includes("json")) throw new Error("La fuente no entregó JSON");
  const data: unknown = await response.json();
  if (data && typeof data === "object" && "error" in data) throw new Error("La fuente rechazó la consulta");
  return data;
}
const cache = new Map<string, { until: number; value: Promise<unknown> }>();
/**
 * Reutiliza en memoria una consulta identificada por key durante ttl milisegundos.
 * Si no hay una consulta vigente, ejecuta loader; si falla, la retira para permitir otro intento.
 * El plazo predeterminado es de 5 minutos y los datos se pierden al reiniciar el backend.
 */
export function cached<T>(key: string, loader: () => Promise<T>, ttl = 300000): Promise<T> {
  const entry = cache.get(key);
  if (entry && entry.until > Date.now()) return entry.value as Promise<T>;
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  const value = loader().catch(error => { cache.delete(key); throw error; });
  cache.set(key, { until: Date.now() + ttl, value });
  return value;
}
/**
 * Comprueba que la dirección configurada use HTTPS y el dominio oficial esperado.
 * Rechaza direcciones con credenciales y quita la barra final para formar los endpoints.
 */
export function officialBase(value: string, host: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== host || url.username || url.password) throw new Error("Configuración de fuente inválida");
  return value.replace(/\/$/, "");
}
