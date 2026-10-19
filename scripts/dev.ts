import { spawn } from "bun";
import { resolve } from "node:path";
const root = resolve(import.meta.dir, "..");
const test = process.argv.includes("--test");
const emulators = process.argv.includes("--emulators") || test;
const env = { ...process.env, ...(emulators ? {
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_PROJECT_ID: "demo-visual-community", VITE_USE_FIREBASE_EMULATORS: "true",
} : {}), ...(test ? { PORT: "3001", VITE_DEV_PORT: "5174", API_PROXY_TARGET: "http://127.0.0.1:3001", FRONTEND_ORIGIN: "http://127.0.0.1:5174" } : {}) };
const children: ReturnType<typeof spawn>[] = [];
function start(cmd: string[], cwd = root) {
  const child = spawn(cmd, { cwd, env, stdout: "inherit", stderr: "inherit", stdin: "ignore" });
  children.push(child); return child;
}
function stop() { for (const child of children) child.kill(); }
process.on("SIGINT", () => { stop(); process.exit(0); });
process.on("SIGTERM", () => { stop(); process.exit(0); });
if (emulators && !test) {
  const emulator = start([process.execPath, "run", "emulators"]);
  const end = Date.now() + 120000;
  let ready = false;
  while (Date.now() < end && emulator.exitCode === null) {
    try {
      await Promise.all(["http://127.0.0.1:9099/", "http://127.0.0.1:8080/"].map(url => fetch(url, { signal: AbortSignal.timeout(1000) })));
      ready = true; break;
    } catch { await Bun.sleep(1000); }
  }
  if (!ready) { stop(); throw new Error("No fue posible iniciar los emuladores. Revisa los puertos y Java 21+."); }
}
start([process.execPath, "run", "dev"], resolve(root, "Backend"));
start([process.execPath, "run", "dev"], resolve(root, "Frontend"));
console.log(emulators ? "MODO EMULADORES: usuarios de prueba locales; fuentes oficiales reales." : "Modo Firebase del proyecto.");
await Promise.race(children.map(child => child.exited));
stop();
