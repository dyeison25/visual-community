/** Rechaza un arranque incompleto o con emuladores; nunca imprime valores privados. */
export function validateProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "production") return;
  const required = ["FIREBASE_PROJECT_ID", "FRONTEND_ORIGIN", "ALGOLIA_APP_ID", "ALGOLIA_SEARCH_API_KEY", "ALGOLIA_INDEX_NAME", "GEMINI_API_KEY", "GEMINI_MODEL"];
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error("Variables requeridas en producción: " + missing.join(", "));
  if (env.FIREBASE_AUTH_EMULATOR_HOST || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_PROJECT_ID?.startsWith("demo-")) {
    throw new Error("Los emuladores y proyectos demo no están permitidos en producción.");
  }
}
