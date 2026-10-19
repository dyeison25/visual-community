/** Diagnóstico solo de servidor: conserva el error de Google y oculta credenciales. */
export function redactGeminiSecrets(value: string): string {
  let safe = value;
  for (const secret of [process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY, process.env.OPENAI_API_KEY]) {
    if (!secret?.trim()) continue;
    for (const form of new Set([secret, secret.trim(), encodeURIComponent(secret.trim())]))
      safe = safe.split(form).join("[REDACTED]");
  }
  return safe.replace(/([?&](?:key|api_key)=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/AIza[0-9A-Za-z_-]{30,}/g, "[REDACTED]");
}
export function geminiDiagnostic(error: unknown, model: string) {
  const raw = error && typeof error === "object" ? error as Record<string,unknown> : {};
  const original = typeof raw.message === "string" ? raw.message : "Unknown Gemini error";
  let details: Record<string,unknown> = {};
  try {
    const parsed = JSON.parse(original);
    if (parsed && typeof parsed === "object") details = parsed.error || parsed;
  } catch { /* Los fallos de red no tienen necesariamente cuerpo JSON. */ }
  const reasons = Array.isArray(details.details) ? details.details : [];
  const reason = reasons.find(item => item && typeof item.reason === "string")?.reason;
  const httpStatus = typeof raw.status === "number" ? raw.status : null;
  return {
    provider: "gemini",
    httpStatus,
    code: typeof details.code === "number" ? details.code : httpStatus,
    status: typeof details.status === "string" ? redactGeminiSecrets(details.status) : null,
    reason: typeof reason === "string" ? redactGeminiSecrets(reason) : null,
    message: redactGeminiSecrets(typeof details.message === "string" ? details.message : original),
    model: redactGeminiSecrets(model),
  };
}
export function logGeminiError(error: unknown, model: string) {
  // No registrar el objeto completo: puede contener cabeceras, clave, petición o stack.
  console.error("[Gemini]", JSON.stringify(geminiDiagnostic(error, model)));
}
