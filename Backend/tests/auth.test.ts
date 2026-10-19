import { afterAll, expect, test } from "bun:test";
import { app } from "../src/app";
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const address = server.address();
const base = "http://127.0.0.1:" + (address && typeof address === "object" ? address.port : 0);
afterAll(() => { server.close(); });
test("rechaza las rutas de datos sin sesión", async () => {
  for (const route of ["metrics", "communities", "articles", "regulations", "map"]) {
    expect((await fetch(base + "/api/energy/" + route)).status).toBe(401);
  }
  for (const path of ["/api/discovery/search", "/api/discovery/recommendations"]) expect((await fetch(base + path)).status).toBe(401);
  expect((await fetch(base + "/api/chat", { method:"POST" })).status).toBe(401);
  expect((await fetch(base + "/api/auth/me")).status).toBe(401);
  expect((await fetch(base + "/api/profile/metrics")).status).toBe(401);
  for (const path of ["/api/admin/summary", "/api/admin/users", "/api/admin/users/another-user"]) expect((await fetch(base + path)).status).toBe(401);
});
test("el login anterior no acepta correo y contraseña sin verificarlos", async () => {
  const response = await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "prueba@example.invalid", password: "incorrecta" }) });
  expect(response.status).toBe(410);
});
test("health mantiene disponible la plataforma", async () => {
  expect((await fetch(base + "/api/health")).status).toBe(200);
});
test("respuestas de API no se cachean y CORS no autoriza un dominio ajeno", async () => {
  const response = await fetch(base + "/api/health", { headers: { Origin: "https://untrusted.example" } });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
  const allowed = await fetch(base + "/api/health", { headers: { Origin: "http://127.0.0.1:5173" } });
  expect(allowed.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
});
test("JSON inválido y cuerpos excesivos tienen errores controlados", async () => {
  const request = (body: string) => fetch(base + "/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  expect((await request("{")).status).toBe(400);
  const response = await request(JSON.stringify({ question: "x".repeat(25000) }));
  expect(response.status).toBe(413);
  expect(await response.text()).not.toContain("stack");
});
