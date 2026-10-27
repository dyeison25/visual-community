import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  if (command === "build") {
    const unsafe = Object.keys(env).filter(name => name.startsWith("VITE_") && /GEMINI|OPENAI|ALGOLIA|RESEND|EMAIL_FROM|PRIVATE|SECRET|PASSWORD|CREDENTIAL/i.test(name));
    if (unsafe.length) throw new Error("Variables privadas no permitidas en Vite: " + unsafe.join(", "));
    if (process.env.VC_RELEASE_BUILD === "true") {
      const required = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID", "VITE_API_BASE_URL"];
      const missing = required.filter(name => !env[name]?.trim());
      if (missing.length) throw new Error("Falta configuración pública del lanzamiento: " + missing.join(", "));
      const api = new URL(env.VITE_API_BASE_URL!);
      if (api.protocol !== "https:" || api.pathname !== "/api" || api.search || api.hash || api.username || api.password) throw new Error("VITE_API_BASE_URL debe ser la URL HTTPS de la API, terminada en /api.");
      if (env.VITE_USE_FIREBASE_EMULATORS === "true" || env.VITE_FIREBASE_PROJECT_ID?.startsWith("demo-")) throw new Error("No se publica una configuración de emuladores.");
    }
  }
  return {
  plugins: [react()],
  server: { port: Number(process.env.VITE_DEV_PORT) || 5173, strictPort: true, proxy: { "/api": process.env.API_PROXY_TARGET || "http://127.0.0.1:3000" } },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes("/node_modules/")) {
      if (id.includes("/firebase/firestore/") || id.includes("/@firebase/firestore/")) return "firebase-firestore";
      if (id.includes("/firebase/") || id.includes("/@firebase/")) return "firebase-core";
      if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/react-router") || id.includes("/scheduler/")) return "react";
      if (id.includes("/lucide-react/")) return "icons";
    }
  } } } },
  };
});
