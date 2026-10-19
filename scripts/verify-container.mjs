// Ejecutado por stdin dentro del contenedor aislado; no utiliza credenciales reales.
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';

assert.notEqual(process.getuid(), 0, 'El servidor no debe ejecutarse como root.');
assert.equal(process.env.NODE_ENV, 'production');
assert.ok(existsSync('/app/Backend/dist/index.js'));
for (const path of ['src', 'scripts', 'tests', '.env', 'firebase-service-account.json', 'node_modules/typescript']) {
  assert.equal(existsSync(`/app/Backend/${path}`), false, `Archivo innecesario en runtime: ${path}`);
}
assert.deepEqual(readdirSync('/app').sort(), ['Backend']);
assert.deepEqual(readdirSync('/app/Backend').sort(), ['dist', 'node_modules', 'package.json']);

const base = 'http://127.0.0.1:8080';
let ready = false;
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
    if (response.ok) { ready = true; break; }
  } catch { /* Esperar únicamente el arranque local. */ }
  await new Promise(resolve => setTimeout(resolve, 250));
}
assert.ok(ready, 'La API no inició dentro del contenedor.');
const health = await fetch(`${base}/api/health`, { headers: { Origin: 'https://container-check.example' } });
assert.equal((await health.json()).authMode, 'firebase');
assert.equal(health.headers.get('access-control-allow-origin'), 'https://container-check.example');
assert.equal(health.headers.get('cache-control'), 'private, no-store');
assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
const foreign = await fetch(`${base}/api/health`, { headers: { Origin: 'https://untrusted.example' } });
assert.equal(foreign.headers.get('access-control-allow-origin'), null);

const routes = [
  ['/api/admin/summary', 'GET'], ['/api/profile/metrics', 'GET'],
  ['/api/discovery/recommendations', 'GET'], ['/api/discovery/search?q=energia', 'GET'],
  ['/api/energy/map', 'GET'], ['/api/chat', 'POST'],
];
for (const [path, method] of routes) {
  const response = await fetch(base + path, { method });
  assert.equal(response.status, 401, `La ruta ${path} debe exigir autenticación.`);
}
assert.equal((await fetch(`${base}/api/inexistente`)).status, 404);
console.log(JSON.stringify({ productionStarts: true, nonRoot: true, runtimeFilesOnly: true,
  health: true, protectedRoutes: routes.length, cors: true, externalCalls: 0 }));
