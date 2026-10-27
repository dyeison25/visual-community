// Arranca el artefacto compilado en un puerto libre; no toca datos ni proveedores.
import { resolve } from "node:path";
import { createServer } from "node:net";
const backend = resolve(import.meta.dir, "../Backend");
const portServer = createServer();
await new Promise<void>(resolve => portServer.listen(0, "127.0.0.1", resolve));
const address = portServer.address();
if (!address || typeof address === "string") throw Error("No se obtuvo un puerto.");
const port = address.port;
await new Promise<void>(resolve => portServer.close(() => resolve()));
const child = Bun.spawn([process.execPath, "dist/index.js"], {
  cwd: backend, stdout: "ignore", stderr: "ignore",
  env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOST: "127.0.0.1", FRONTEND_ORIGIN: "https://launch-check.example", FIREBASE_PROJECT_ID: "production-startup-check", FIREBASE_AUTH_EMULATOR_HOST: "", FIRESTORE_EMULATOR_HOST: "" },
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (child.exitCode !== null) throw Error("El backend compilado no inició; revisar configuración requerida.");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* Se espera el arranque, sin consultar servicios externos. */ }
    await Bun.sleep(250);
  }
  if (!ready) throw Error("El backend compilado no quedó disponible.");
  for (const [route, method] of [["/api/admin/summary", "GET"], ["/api/discovery/recommendations", "GET"], ["/api/energy/map", "GET"], ["/api/activity", "POST"], ["/api/notifications/consent", "POST"]]) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, { method });
    if (response.status !== 401) throw Error("Una ruta de datos no rechazó acceso anónimo.");
  }
  console.log(JSON.stringify({ compiledApiStarts: true, productionMode: true, protectedRoutes: true, externalCalls: 0 }));
} finally {
  child.kill("SIGTERM");
  await child.exited;
}
