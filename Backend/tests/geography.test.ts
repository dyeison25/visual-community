import { describe, expect, test } from "bun:test";
import { MAP_LAYERS } from "../../shared/geography";
import { mapIntent } from "../src/services/geography/intent";
import { validateGeography } from "../src/services/geography/validation";
import { createGeoHttp, GeographyError } from "../src/services/geography/http";
import { createGeographyService, metadataStyle, safeGeometry } from "../src/services/geography/geography.service";
import { layers, permittedFields } from "../src/services/geography/catalog";
import { resolvePlace } from "../src/services/geography/places";
import { geographicFixture, placeFixtures, featureFixture } from "./support/geography";

describe("selección contextual explicable", () => {
  for (const [query, expected] of [
    ["Comunidades energéticas en Antioquia", ["communities"]], ["Radiación solar en La Guajira", ["solar"]],
    ["Potencial eólico", ["wind"]], ["Proyectos solares en Antioquia", ["generation"]], ["Plantas de generación hidráulica", ["generation"]],
    ["Proyectos de energía eólica", ["generation"]], ["Potencial solar en Colombia", ["solar"]], ["Central hidroeléctrica", ["generation"]], ["Redes eléctricas", ["substations", "transmission"]],
    ["Subestaciones en Medellín", ["substations"]], ["Líneas de transmisión", ["transmission"]], ["Capacidad asignada", ["connection"]],
    ["Normativa sobre comunidades energéticas", []], ["¿Qué es una comunidad energética?", []], ["Noticias de energía solar", []], ["Demanda energética", []],
    ["Energías renovables", ["solar", "wind", "generation"]], ["Radiación solar y potencial eólico", ["solar", "wind"]], ["Infraestructura eléctrica", ["substations", "transmission"]],
  ] as const) test(query, () => expect(mapIntent(query).candidates).toEqual([...expected]));
  test("una categoría amplia no fuerza solar y la consulta prevalece", () => {
    expect(mapIntent("", "renewable_energy").candidates.length).toBeGreaterThan(1);
    expect(mapIntent("Subestaciones", "renewable_energy").candidates).toEqual(["substations"]);
    expect(mapIntent("", "regulation").candidates).toEqual([]);
  });
});

describe("parámetros, lugares y seguridad", () => {
  test("rechaza URL, SQL, arrays, capas desconocidas y límites inválidos", () => {
    for (const query of [{ url: "https://evil.invalid" }, { where: "1=1" }, { q: ["solar"] }, { layer: "anything" }, { department: "05' OR 1=1" }, { municipality: "1" }, { bbox: "-180,-90,180,90" }, { bbox: "1,1,0,0" }, { q: "x".repeat(181) }, { display: "script" }]) expect(() => validateGeography(query)).toThrow();
    expect(() => validateGeography({ q: "Radiación solar" }, true)).toThrow();
    expect(validateGeography({ q: "Potencial eólico", bbox: "-79,-5,-66,13" }).bbox).toEqual([-79, -5, -66, 13]);
  });
  const places = { departments: [...new Map(placeFixtures.map(row => [row.DPTO_CCDGO, { code: row.DPTO_CCDGO, name: row.DPTO_CNMBRE }])).values()], municipalities: placeFixtures.map(row => ({ departmentCode: row.DPTO_CCDGO, department: row.DPTO_CNMBRE, municipalityCode: row.MPIO_CDPMP, municipality: row.MPIO_CNMBRE })) };
  test("resuelve tildes y no elige entre municipios homónimos", () => {
    expect(resolvePlace({ q: "subestaciones en Medellin" }, places).place?.municipalityCode).toBe("05001");
    expect(resolvePlace({ q: "Comunidades en Santa Rosa" }, places).choices).toHaveLength(2);
    expect(resolvePlace({ q: "Comunidades en Santa Rosa Cauca" }, places).place?.municipalityCode).toBe("19701");
    expect(resolvePlace({ q: "Radiación solar en Atlántida" }, places).unresolved).toBe(true);
  });
  test("un filtro explícito sustituye la ubicación inferida, sin inventar municipios", () => {
    expect(resolvePlace({ q: "Subestaciones en Medellín", department: "44" }, places).place?.municipality).toBeUndefined();
    expect(() => resolvePlace({ q: "", department: "44", municipality: "05001" }, places)).toThrow();
    expect(() => resolvePlace({ q: "", department: "99" }, places)).toThrow();
  });
  test("nombres compuestos no se confunden con otro departamento y varios lugares no se adivinan", () => {
    expect(resolvePlace({ q: "Comunidades en Norte de Santander" }, places).place?.departmentCode).toBe("54");
    expect(resolvePlace({ q: "Radiación en Valle del Cauca" }, places).place?.departmentCode).toBe("76");
    expect(resolvePlace({ q: "Comunidades en Cauca y Valle del Cauca" }, places).choices).toHaveLength(2);
    expect(resolvePlace({ q: "Subestaciones en Medellín y Uribia" }, places).choices).toHaveLength(2);
    expect(resolvePlace({ q: "Subestaciones en Medellín y La Guajira" }, places).unresolved).toBe(true);
  });
  test("no consulta fuentes si no hay intención geográfica o hay varios mapas", async () => {
    const fixture = geographicFixture(); const service = createGeographyService(fixture);
    expect((await service.context({ q: "Normativa solar" })).status).toBe("none");
    expect((await service.context({ q: "Energías renovables" })).status).toBe("choice"); expect(fixture.calls).toHaveLength(0);
    await expect(service.context({ q: "Radiación solar", layer: "communities" })).rejects.toThrow("no corresponde");
  });
  test("municipio ambiguo no dispara consultas UPME", async () => {
    const fixture = geographicFixture(); const context = await createGeographyService(fixture).context({ q: "Comunidades en Santa Rosa" });
    expect(context.status).toBe("place_choice"); expect(context.placeChoices).toHaveLength(2);
    expect(fixture.calls.every(url => url.hostname === "geoportal.dane.gov.co")).toBe(true);
  });
});

describe("consultas oficiales acotadas y geometrías", () => {
  const queries = { communities: "Comunidades energéticas", solar: "Radiación solar", wind: "Potencial eólico", generation: "Proyectos de generación", substations: "Subestaciones", transmission: "Líneas de transmisión", connection: "Capacidad asignada" };
  for (const id of MAP_LAYERS) test("adapta " + id + " y elimina datos personales del proveedor", async () => {
    const fixture = geographicFixture(); const service = createGeographyService(fixture);
    const data = await service.features({ q: queries[id] });
    expect(data.features).toHaveLength(1); expect(data.features[0]!.id).toBe(id + ":1");
    expect(JSON.stringify(data)).not.toMatch(/private@example|no-publicar|CEDULA|CORREO/);
    const query = fixture.calls.find(url => url.searchParams.get("f") === "geojson")!;
    expect(query.searchParams.get("outSR")).toBe("4326"); expect(query.searchParams.get("resultRecordCount")).toBe("250");
    expect(query.searchParams.get("outFields")).not.toMatch(/\*|CEDULA|CORREO|NIT/);
    expect(query.searchParams.get("outFields")!.split(",").sort()).toEqual(permittedFields(layers[id]).sort());
  });
  test("combina tecnología real, código municipal y encuadre verificado", async () => {
    const fixture = geographicFixture(); await createGeographyService(fixture).features({ q: "Proyectos solares en Medellín" });
    const query = fixture.calls.find(url => url.searchParams.get("f") === "geojson")!;
    expect(query.searchParams.get("where")).toContain("cod_mpio='05001'"); expect(query.searchParams.get("where")).toContain("tipo_generacion IN ('SOLAR')");
    expect(query.searchParams.get("geometry")).toBe("-76,5,-74,7");
    const distinct = fixture.calls.find(url => url.searchParams.has("returnDistinctValues"))!;
    expect(distinct.searchParams.get("orderByFields")).toBe("tipo_generacion");
  });
  test("departamento de generación usa el prefijo del código municipal publicado", async () => {
    const fixture = geographicFixture(); await createGeographyService(fixture).features({ q: "Generación", department: "05" });
    expect(fixture.calls.find(url => url.searchParams.get("f") === "geojson")!.searchParams.get("where")).toContain("cod_mpio LIKE '05%'");
  });
  test("no inventa tecnología ni sustituye una consulta sin coincidencias", async () => {
    const fixture = geographicFixture(); const service = createGeographyService(fixture);
    await expect(service.context({ q: "Generación", technology: "unknown' OR '1'='1" })).rejects.toThrow("tecnología");
    expect((await service.features({ q: "Generación con biomasa" })).features).toHaveLength(0);
    await service.features({ q: "Proyectos solares", technology: "all" });
    expect(fixture.calls.find(url => url.searchParams.get("f") === "geojson")!.searchParams.get("where")).toBe("1=1");
  });
  test("el potencial eólico regional se declara como intersección de extensión, no límite exacto", async () => {
    const fixture = geographicFixture(); const service = createGeographyService(fixture);
    const context = await service.context({ q: "Potencial eólico en La Guajira" });
    expect(context.territorialMode).toBe("extent"); expect(context.warnings.join(" ")).toContain("no es un recorte");
    expect((await service.features({ q: "Potencial eólico en La Guajira", bbox: [-79, -5, -78, -4] })).features).toHaveLength(0);
    expect(fixture.calls.some(url => url.searchParams.get("f") === "geojson")).toBe(false);
  });
  test("WMS tiene ruta cerrada y no permite simular un filtro territorial exacto", async () => {
    const fixture = geographicFixture(); const service = createGeographyService(fixture);
    const image = await service.wms({ q: "Radiación solar", display: "wms", bbox: [-79, -5, -66, 13] });
    const url = fixture.calls.find(url => url.pathname.endsWith("WMSServer"))!;
    expect(url.pathname).toContain("/server/services/"); expect(url.searchParams.get("layers")).toBe("0"); expect(url.searchParams.get("request")).toBe("GetMap");
    expect(image.bounds).toEqual([-76, 5, -74, 7]); expect(url.searchParams.get("srs")).toBe("EPSG:3857"); expect(Number(url.searchParams.get("bbox")!.split(",")[0])).toBeLessThan(-8000000);
    await expect(service.wms({ q: "Radiación solar en Antioquia", display: "wms", bbox: [-79, -5, -66, 13] })).rejects.toThrow("panorámica");
  });
  test("rechaza geometrías inexistentes, proyectadas o no soportadas", () => {
    for (const value of [null, { type: "Point", coordinates: [4000000, 2000000] }, { type: "Point", coordinates: [0, 0] }, { type: "Point", coordinates: [NaN, 4] }, { type: "Polygon", coordinates: [] }, { type: "LineString", coordinates: [[-75, 6]] }, { type: "Polygon", coordinates: [[[-75, 6], [-74, 6], [-74, 7]]] }, { type: "GeometryCollection", geometries: [] }]) expect(safeGeometry(value)).toBeNull();
    expect(safeGeometry({ type: "Point", coordinates: [-75, 6] })).not.toBeNull();
  });
  test("conserva límites, descarta registros sin geometría y señala truncamiento", async () => {
    const fixture = geographicFixture(); const service = createGeographyService({ fetcher: async (url, init) => {
      if (String(url).includes("f=geojson")) { const data = featureFixture("communities"); return Response.json({ ...data, exceededTransferLimit: true, features: [...data.features, { ...data.features[0], geometry: null }] }); }
      return fixture.fetcher(url, init);
    } });
    const data = await service.features({ q: "Comunidades" }); expect(data.features).toHaveLength(1); expect(data.discarded).toBe(1); expect(data.truncated).toBe(true);
  });
  test("no admite una capa que cambió sus campos", async () => {
    const fixture = geographicFixture(); const service = createGeographyService({ fetcher: async (url, init) => String(url).includes("FeatureServer/19?") ? Response.json({ fields: [], capabilities: "Query", geometryType: "esriGeometryPoint" }) : fixture.fetcher(url, init) });
    await expect(service.context({ q: "Comunidades" })).rejects.toThrow("estructura");
  });
  test("la leyenda utiliza rangos y colores reales del renderer, sin generar mediciones", () => {
    const result = metadataStyle({ drawingInfo: { renderer: { field1: "rango", uniqueValueInfos: [{ value: "8-27", label: "8-27", symbol: { color: [10, 20, 30, 255] } }] } } }, layers.wind);
    expect(result.legend).toEqual([{ label: "8-27", color: "#0a141e" }]);
  });
});

describe("fallos, caché, cancelación y carga", () => {
  const url = "https://geo.upme.gov.co/server/rest/services/test?f=json";
  test("diagnóstico controlado distingue el rechazo oficial sin exponer cabeceras o cuerpos", async () => {
    const http = createGeoHttp(async () => new Response("private-upstream-body", { status: 403, headers: { "content-type": "text/html", authorization: "private-header" } }));
    try { await http.json(url); throw Error("Se esperaba el rechazo"); } catch (error) {
      expect(error).toBeInstanceOf(GeographyError);
      expect((error as GeographyError).diagnostic).toEqual({ source: "UPME", reason: "http", upstreamStatus: 403 });
      expect(JSON.stringify(error)).not.toMatch(/private|authorization|https/);
    }
  });
  test("reutiliza respuestas válidas y no conserva errores ArcGIS", async () => {
    let calls = 0; const http = createGeoHttp(async () => Response.json(++calls === 1 ? { error: { code: 499 } } : { ok: true }));
    await expect(http.json(url)).rejects.toThrow(); expect(await http.json(url)).toEqual({ ok: true }); expect(await http.json(url)).toEqual({ ok: true }); expect(calls).toBe(2);
  });
  test("rechaza redirecciones ajenas, HTML e imágenes falsas sin publicar detalles", async () => {
    let calls = 0; const http = createGeoHttp(async () => { calls++; return new Response("private upstream detail", { headers: { "content-type": "text/html" } }); });
    await expect(http.json("https://evil.invalid/server/rest/services/test")).rejects.toThrow("permitida"); expect(calls).toBe(0);
    await expect(http.json(url)).rejects.toThrow("temporalmente");
    await expect(createGeoHttp(async () => new Response("not-png", { headers: { "content-type": "image/png" } })).image(url)).rejects.toThrow();
  });
  test("limita tamaño y cancela antes de consumir fuentes", async () => {
    let cancelled = false;
    const http = createGeoHttp(async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "content-type": "application/json", "content-length": "4000001" } }));
    await expect(http.json(url)).rejects.toThrow(); expect(cancelled).toBe(true);
    const controller = new AbortController(); controller.abort(); let calls = 0;
    await expect(createGeoHttp(async () => { calls++; return Response.json({}); }).json(url, controller.signal)).rejects.toThrow(); expect(calls).toBe(0);
  });
  test("propaga cancelación durante la petición, sin cachear el resultado", async () => {
    const controller = new AbortController(); let calls = 0;
    const http = createGeoHttp(async (_url, init) => { calls++; controller.abort(); init!.signal!.throwIfAborted(); return Response.json({}); });
    await expect(http.json(url, controller.signal)).rejects.toThrow(); expect(calls).toBe(1);
  });
  test("un timeout termina la espera y conserva un error público controlado", async () => {
    const http = createGeoHttp(async (_url, init) => new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason), { once: true })), Date.now, 10);
    await expect(http.json(url)).rejects.toThrow("temporalmente");
  });
  test("acota concurrencia a tres peticiones aunque se soliciten cuatro", async () => {
    const gates: (() => void)[] = []; let active = 0; let max = 0;
    const http = createGeoHttp(async () => { active++; max = Math.max(max, active); await new Promise<void>(resolve => gates.push(resolve)); active--; return Response.json({ ok: true }); });
    const promises = [1, 2, 3, 4].map(i => http.json(url + "&id=" + i));
    await Promise.resolve(); expect(gates).toHaveLength(3); gates.splice(0).forEach(resolve => resolve());
    await Promise.all(promises.slice(0, 3)); expect(gates).toHaveLength(1); gates[0]!(); await promises[3]; expect(max).toBe(3);
  });
});
