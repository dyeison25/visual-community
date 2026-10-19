// La identidad de esta plataforma pertenece exclusivamente a Firebase Authentication.
// No se crean JWT propios ni se usa energy-community-auth-sdk.
export function allowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.FRONTEND_ORIGIN?.trim();
  if (!configured && env.NODE_ENV === "production") throw new Error("FRONTEND_ORIGIN es obligatorio en producción.");
  const origins = (configured || "http://localhost:5173,http://127.0.0.1:5173").split(",").map(value => value.trim());
  for (const origin of origins) {
    let url: URL;
    try { url = new URL(origin); } catch { throw new Error("FRONTEND_ORIGIN debe contener orígenes válidos, sin comodines."); }
    if (url.origin !== origin || !["http:", "https:"].includes(url.protocol) || (env.NODE_ENV === "production" && url.protocol !== "https:")) {
      throw new Error("FRONTEND_ORIGIN debe contener orígenes exactos; en producción se requiere HTTPS.");
    }
  }
  return [...new Set(origins)];
}
export const authConfig = { allowedOrigins: allowedOrigins() };
