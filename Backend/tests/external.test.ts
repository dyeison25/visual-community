import { describe, expect, test } from "bun:test";
import { MINISTRY_COMMUNITIES_PAGE } from "../../shared/officialSources";
import { parseXm, getXmMetrics, xmWindow } from "../src/services/xm/xm.service";
import { parseCommunities, communityWhere, getCommunities } from "../src/services/minenergia/minenergia.service";
import { fetchJson } from "../src/services/external/http";
import { validatePreferences, profileTopics } from "../../shared/preferences";
import { validateCredentials } from "../../shared/validation";
const hourly = (value: unknown) => Object.fromEntries(Array.from({ length: 24 }, (_, i) => ["Hour" + String(i + 1).padStart(2, "0"), value]));
const fixture = (id: string, values = hourly("1000000")) => ({ Metric: { Id: id }, Items: [{ Date: "2026-09-01", HourlyEntities: [{ Id: "Sistema", Values: values }] }] });
describe("Datos XM: transformación y degradación", () => {
  test("convierte kWh a GWh y conserva precio en COP/kWh", () => {
    expect(parseXm(fixture("Gene"), "Gene")[0]?.value).toBe(24);
    expect(parseXm(fixture("PrecBolsNaci", hourly("120.5")), "PrecBolsNaci")[0]?.value).toBe(120.5);
  });
  test("no convierte null o falta de horas en ceros; acepta cero real", () => {
    expect(parseXm(fixture("Gene", hourly(null)), "Gene")).toEqual([]);
    expect(parseXm(fixture("Gene", { Hour01: 100 }), "Gene")).toEqual([]);
    expect(parseXm(fixture("Gene", hourly("0")), "Gene")[0]?.value).toBe(0);
  });
  test("rechaza formatos, entidades y métricas inesperados", () => {
    expect(() => parseXm({}, "Gene")).toThrow();
    expect(() => parseXm(fixture("DemaReal"), "Gene")).toThrow();
    expect(() => parseXm({ Metric: { Id: "Gene" }, Items: [{ Date: "2026-09-01", HourlyEntities: [] }] }, "Gene")).toThrow();
  });
  test("una métrica caída no impide mostrar las demás", async () => {
    const result = await getXmMetrics(async (_url, init) => {
      const { MetricId } = JSON.parse(String(init?.body));
      if (MetricId === "DemaReal") throw new Error("Simulación de fuente caída");
      return Response.json(fixture(MetricId));
    });
    expect(result.status).toBe("partial");
    expect(result.data[1]?.value).toBeNull();
    expect(result.data[0]?.status).toBe("ok");
  });
  test("ventana de fecha según Colombia antes de medianoche local", () => {
    expect(xmWindow(new Date("2026-09-07T02:00:00Z")).EndDate).toBe("2026-09-05");
  });
});
describe("MinEnergía", () => {
  test("transforma únicamente los campos públicos necesarios", () => {
    const rows = parseCommunities({ features: [{ attributes: { FID: 0, Nombre_de_: "Comunidad de prueba (fixture)", Departamen: "Departamento de prueba", Municipio: "Municipio de prueba", correo_ele: "no-propagar@example.invalid" }, geometry: { x: -72, y: 11 } }] });
    expect(rows[0]?.longitude).toBe(-72);
    expect(rows[0]?.sourceUrl).toBe(MINISTRY_COMMUNITIES_PAGE);
    expect(rows[0]?.sourceUrl).not.toContain("/query");
    expect(JSON.stringify(rows)).not.toContain("correo_ele");
    expect(JSON.stringify(rows)).not.toContain("example.invalid");
  });
  test("escapa texto de consulta ArcGIS", () => {
    expect(communityWhere("O'Brien")).toContain("O''BRIEN");
    expect(communityWhere("")).toBe("1=1");
  });
  test("pagina por objectIds porque MapServer no soporta resultOffset", async () => {
    const urls: string[] = [];
    const result = await getCommunities(24, "", async url => {
      urls.push(String(url));
      return Response.json(String(url).includes("returnIdsOnly") ? { objectIdFieldName: "FID", objectIds: Array.from({ length: 25 }, (_, i) => i) } : { features: [{ attributes: { FID: 24, Nombre_de_: "Fixture" } }] });
    });
    expect(result.data.total).toBe(25);
    expect(urls[1]).toContain("objectIds=24");
    expect(urls.join("")).not.toContain("resultOffset");
  });
  test("devuelve estado no disponible sin registros ficticios", async () => {
    const result = await getCommunities(0, "", async () => { throw new Error("Timeout simulado"); });
    expect(result.status).toBe("unavailable"); expect(result.data.total).toBeNull(); expect(result.data.communities).toEqual([]);
  });
});
test("HTTP rechaza HTML, error ArcGIS y estado fallido", async () => {
  await expect(fetchJson("https://example.invalid", {}, async () => new Response("<html/>"))).rejects.toThrow();
  await expect(fetchJson("https://example.invalid", {}, async () => Response.json({ error: { code: 400 } }))).rejects.toThrow();
  await expect(fetchJson("https://example.invalid", {}, async () => new Response("", { status: 503 }))).rejects.toThrow();
});
test("formularios: correo y contraseña de registro", () => {
  expect(validateCredentials("no-correo", "Password123", true, "Prueba")).toBeTruthy();
  expect(validateCredentials("prueba@example.invalid", "123", true, "Prueba")).toBeTruthy();
  expect(validateCredentials("prueba@example.invalid", "Password123", true, "Prueba")).toBeNull();
});

test("preferencias: selección obligatoria, valores conocidos y sin duplicados", () => {
  expect(validatePreferences([], [])).toBeTruthy();
  expect(validatePreferences(["unknown"], [])).toBeTruthy();
  expect(validatePreferences(["regulation", "regulation"], [])).toBeTruthy();
  expect(validatePreferences(["regulation"], ["unknown"])).toBeTruthy();
  expect(validatePreferences(["energy_communities", "regulation"], ["education"])).toBeNull();
  expect(profileTopics({ userId: "legacy", name: "Anterior", interests: ["Energía solar", "Normativa"], preferences: { compactMetrics: true } })).toEqual(["renewable_energy", "regulation"]);
});
