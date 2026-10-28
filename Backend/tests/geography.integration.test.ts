import { afterAll, expect, test } from "bun:test";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { app as productionApp } from "../src/app";
import { createGeographyRoutes } from "../src/routes/geography.routes";
import { createGeographyService } from "../src/services/geography/geography.service";
import { geographicFixture } from "./support/geography";

// Servidor aislado con upstream sintético. La autenticación se verifica contra el app real por separado.
const fixture = geographicFixture(); const local = express();
local.use("/api/geography", createGeographyRoutes(createGeographyService(fixture)));
const server = local.listen(0, "127.0.0.1"); await once(server, "listening");
const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port + "/api/geography/";
const protectedServer = productionApp.listen(0, "127.0.0.1"); await once(protectedServer, "listening");
afterAll(async () => { await Promise.all([new Promise<void>(resolve => server.close(() => resolve())), new Promise<void>(resolve => protectedServer.close(() => resolve()))]); });

test("integración geográfica: las rutas de datos y diagnóstico requieren sesión", async () => {
  const root = "http://127.0.0.1:" + (protectedServer.address() as AddressInfo).port;
  for (const path of ["context", "features", "wms", "availability"]) expect((await fetch(root + "/api/geography/" + path + "?q=solar")).status).toBe(401);
});
test("integración geográfica: interpreta, filtra y devuelve solo el contrato público", async () => {
  const params = new URLSearchParams({ q: "Proyectos solares en Medellín" });
  const contextResponse = await fetch(base + "context?" + params); expect(contextResponse.status).toBe(200);
  const context = await contextResponse.json(); expect(context.layer.id).toBe("generation"); expect(context.place.municipalityCode).toBe("05001");
  expect(JSON.stringify(context)).not.toMatch(/FeatureServer|MapServer|CEDULA|CORREO/);
  const response = await fetch(base + "features?" + params); expect(response.status).toBe(200);
  const body = await response.text(); expect(body).not.toMatch(/private@example|CEDULA|no-publicar/); expect(JSON.parse(body).features).toHaveLength(1);
});
test("integración geográfica: rechaza parámetros extra, duplicados, capa ajena y filtros incompatibles", async () => {
  for (const query of ["q=solar&url=https://evil.invalid", "q=solar&q=wind", "q=Radiaci%C3%B3n%20solar&layer=communities", "q=Comunidades&department=44&municipality=05001", "q=Comunidades&technology=SOLAR", "q=solar&bbox=NaN,0,1,2"]) {
    const response = await fetch(base + "context?" + query); expect(response.status).toBe(400); expect(await response.text()).not.toContain("stack");
  }
});
test("integración geográfica: sirve PNG autenticable sin URLs arbitrarias ni parámetros WMS del cliente", async () => {
  const response = await fetch(base + "wms?" + new URLSearchParams({ q: "Radiación solar", bbox: "-79,-5,-66,13", display: "wms" }));
  expect(response.status).toBe(200); expect(response.headers.get("content-type")).toContain("image/png"); expect(new Uint8Array(await response.arrayBuffer())[0]).toBe(137);
  expect(response.headers.get("x-map-bounds")).toBe("-76,5,-74,7"); expect(response.headers.get("access-control-expose-headers")).toBe("X-Map-Bounds");
  expect((await fetch(base + "wms?q=solar&request=GetCapabilities")).status).toBe(400);
});
test("integración geográfica: limita por usuario con un presupuesto independiente", async () => {
  const isolated = express(); isolated.use((req, res, next) => { res.locals.user = { uid: req.headers["x-fixture-user"] || "fixture-a" }; next(); });
  isolated.use(createGeographyRoutes(createGeographyService(geographicFixture())));
  const limitedServer = isolated.listen(0, "127.0.0.1"); await once(limitedServer, "listening");
  try {
    const url = "http://127.0.0.1:" + (limitedServer.address() as AddressInfo).port + "/context?q=Normativa";
    for (let index = 0; index < 45; index++) expect((await fetch(url)).status).toBe(200);
    const blocked = await fetch(url); expect(blocked.status).toBe(429); expect(blocked.headers.get("retry-after")).toBe("60");
    expect((await fetch(url, { headers: { "x-fixture-user": "fixture-b" } })).status).toBe(200);
  } finally { await new Promise<void>(resolve => limitedServer.close(() => resolve())); }
});
test("integración geográfica: falla de proveedor termina en mensaje comprensible sin filtrar el error original", async () => {
  const failing = express(); failing.use(createGeographyRoutes(createGeographyService({ fetcher: async () => { throw Error("credential-like-private-upstream-error"); } })));
  const errorServer = failing.listen(0, "127.0.0.1"); await once(errorServer, "listening");
  try {
    const response = await fetch("http://127.0.0.1:" + (errorServer.address() as AddressInfo).port + "/context?q=Comunidades");
    expect(response.status).toBe(503); const body = await response.text(); expect(body).toContain("temporalmente"); expect(body).not.toMatch(/credential|stack|private/);
  } finally { await new Promise<void>(resolve => errorServer.close(() => resolve())); }
});

test("diagnóstico de disponibilidad consulta solo dos metadatos cerrados y no expone fallos privados", async () => {
  const calls: string[] = [];
  const diagnostic = express(); diagnostic.use(createGeographyRoutes(createGeographyService({ fetcher: async url => {
    calls.push(String(url));
    if (String(url).includes("dane.gov.co")) throw Error("private-upstream-failure");
    return Response.json({ currentVersion: 11 });
  } })));
  const diagnosticServer = diagnostic.listen(0, "127.0.0.1"); await once(diagnosticServer, "listening");
  try {
    const url = "http://127.0.0.1:" + (diagnosticServer.address() as AddressInfo).port + "/availability";
    const response = await fetch(url); const body = await response.json();
    expect(body.sources).toEqual([{ source: "DANE", available: false, diagnostic: { source: "DANE", reason: "network" } }, { source: "UPME", available: true }]);
    expect(calls).toHaveLength(2); expect(calls.every(url => url.endsWith("?f=json") && !url.includes("/query"))).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/private|stack|https/);
    expect((await fetch(url + "?q=solar")).status).toBe(400); expect(calls).toHaveLength(2);
  } finally { await new Promise<void>(resolve => diagnosticServer.close(() => resolve())); }
});
test("integración geográfica: cerrar el cliente cancela la consulta oficial", async () => {
  let started!: () => void; let stopped!: () => void;
  const start = new Promise<void>(resolve => { started = resolve; }); const stop = new Promise<void>(resolve => { stopped = resolve; });
  const cancelled = express(); cancelled.use(createGeographyRoutes(createGeographyService({ fetcher: async (_url, init) => {
    started(); await new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => { stopped(); reject(init!.signal!.reason); }, { once: true }));
    throw Error("No se debe completar una respuesta cancelada");
  } })));
  const cancellationServer = cancelled.listen(0, "127.0.0.1"); await once(cancellationServer, "listening");
  const controller = new AbortController();
  try {
    const pending = fetch("http://127.0.0.1:" + (cancellationServer.address() as AddressInfo).port + "/context?q=Comunidades", { signal: controller.signal }).catch(() => null);
    await start; controller.abort(); await pending; await stop;
  } finally { await new Promise<void>(resolve => cancellationServer.close(() => resolve())); }
});
