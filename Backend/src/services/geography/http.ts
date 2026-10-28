import type { Fetcher } from "../external/http";
export class GeographyError extends Error {
  constructor(readonly status: number, message: string, readonly diagnostic?: { source: "UPME" | "DANE"; reason: "http" | "content_type" | "timeout" | "network" | "invalid_response"; upstreamStatus?: number; networkCode?: string }) { super(message); }
}
const unavailable = (diagnostic?: GeographyError["diagnostic"]) => new GeographyError(503, "La información geográfica oficial no está disponible temporalmente. Los resultados de búsqueda siguen disponibles.", diagnostic);
function safeNetworkCode(error: unknown, depth = 0): string | undefined {
  const allowed = new Set(["CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "ERR_TLS_CERT_ALTNAME_INVALID", "CERT_SIGNATURE_FAILURE", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "EHOSTUNREACH", "ETIMEDOUT", "ConnectionRefused", "ConnectionClosed", "FailedToOpenSocket"]);
  if (!error || typeof error !== "object" || depth > 3) return undefined;
  const direct = "code" in error ? error.code : undefined;
  if (typeof direct === "string" && allowed.has(direct)) return direct;
  return "cause" in error && error.cause !== error ? safeNetworkCode(error.cause, depth + 1) : undefined;
}
/** Caché pública efímera y acotada. Las cancelaciones no conservan respuestas incompletas. */
export function createGeoHttp(fetcher: Fetcher = fetch, now = Date.now, timeoutMs = 12000) {
  const cache = new Map<string, { expires: number; bytes: Uint8Array; type: string }>();
  let cachedBytes = 0; let active = 0;
  const waiting: (() => void)[] = [];
  async function acquire(signal: AbortSignal) {
    signal.throwIfAborted();
    if (active < 3) { active++; return; }
    if (waiting.length >= 12) throw new GeographyError(503, "El servicio de mapas está ocupado. Intenta nuevamente en un momento.");
    await new Promise<void>((resolve, reject) => {
      const ready = () => { signal.removeEventListener("abort", abort); resolve(); };
      const abort = () => { const index = waiting.indexOf(ready); if (index >= 0) waiting.splice(index, 1); reject(signal.reason); };
      waiting.push(ready); signal.addEventListener("abort", abort, { once: true });
    });
    if (signal.aborted) { release(); signal.throwIfAborted(); }
  }
  function release() { const next = waiting.shift(); if (next) next(); else active--; }
  async function request(url: string, signal?: AbortSignal, ttl = 300000, image = false) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port
      || !["geo.upme.gov.co", "geoportal.dane.gov.co"].includes(parsed.hostname)
      || !/^\/(server\/(rest\/)?services\/|mparcgis\/rest\/services\/MGN2025\/)/.test(parsed.pathname)) throw new GeographyError(400, "Fuente geográfica no permitida.");
    const source = parsed.hostname === "geo.upme.gov.co" ? "UPME" as const : "DANE" as const;
    signal?.throwIfAborted();
    const key = (image ? "image:" : "json:") + url; const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached;
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(new DOMException("Geographic deadline", "TimeoutError")), image ? Math.max(timeoutMs, 20000) : timeoutMs);
    const combined = AbortSignal.any([...(signal ? [signal] : []), deadline.signal]);
    try { await acquire(combined); } catch (error) { clearTimeout(timer); if (signal?.aborted) throw signal.reason; throw error instanceof GeographyError ? error : unavailable(); }
    try {
      // No seguir redirecciones: conservar el estado HTTP para diagnosticarlas sin
      // confundirlas con un error de red ni consultar un destino fuera del catálogo.
      const response = await fetcher(url, { signal: combined, redirect: "manual", headers: { Accept: image ? "image/png" : "application/json" } });
      const type = response.headers.get("content-type") || "";
      if (!response.ok || !(image ? type.startsWith("image/png") : type.includes("json"))) { await response.body?.cancel().catch(() => {}); throw unavailable({ source, reason: response.ok ? "content_type" : "http", upstreamStatus: response.status }); }
      const max = image ? 1_200_000 : 4_000_000;
      const tooLarge = () => new GeographyError(413, "El área devuelve demasiada información geográfica. Acerca el mapa o selecciona un territorio menor.");
      if (Number(response.headers.get("content-length")) > max) { await response.body?.cancel().catch(() => {}); throw tooLarge(); }
      const reader = response.body?.getReader(); if (!reader) throw unavailable();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) { combined.throwIfAborted(); const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength; if (size > max) throw tooLarge(); chunks.push(part.value);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      if (image && ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) throw unavailable();
      combined.throwIfAborted();
      const value = { expires: now() + ttl, bytes, type };
      const previous = cache.get(key); if (previous) { cachedBytes -= previous.bytes.length; cache.delete(key); }
      while (cache.size && (cache.size >= 64 || cachedBytes + size > 12_000_000)) {
        const oldest = cache.keys().next().value!; cachedBytes -= cache.get(oldest)!.bytes.length; cache.delete(oldest);
      }
      cache.set(key, value); cachedBytes += size; return value;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (error instanceof GeographyError) throw error;
      const networkCode = safeNetworkCode(error);
      throw unavailable({ source, reason: deadline.signal.aborted ? "timeout" : "network", ...(networkCode ? { networkCode } : {}) });
    } finally { clearTimeout(timer); release(); }
  }
  return {
    async json(url: string, signal?: AbortSignal, ttl?: number): Promise<Record<string, any>> {
      const result = await request(url, signal, ttl);
      try { const data: unknown = JSON.parse(new TextDecoder().decode(result.bytes));
        if (!data || typeof data !== "object" || Array.isArray(data) || "error" in data) throw unavailable();
        return data as Record<string, any>;
      } catch { const key = "json:" + url; const old = cache.get(key); if (old) { cachedBytes -= old.bytes.length; cache.delete(key); } throw unavailable({ source: new URL(url).hostname === "geo.upme.gov.co" ? "UPME" : "DANE", reason: "invalid_response" }); }
    },
    async image(url: string, signal?: AbortSignal) { return (await request(url, signal, 60000, true)).bytes; },
  };
}
export type GeoHttp = ReturnType<typeof createGeoHttp>;
