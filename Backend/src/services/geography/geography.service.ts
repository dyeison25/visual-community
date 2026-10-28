import type { GeographyInput, GeoBounds, MapContext, MapData, MapFeature, MapGeometry, MapLegendEntry } from "../../../../shared/geography";
import type { Fetcher } from "../external/http";
import { layers, permittedFields, publicLayer, UPME_REST, DANE_BASE, type LayerDefinition } from "./catalog";
import { createGeoHttp, GeographyError } from "./http";
import { mapIntent, normalize } from "./intent";
import { gazetteer, placeBounds, resolvePlace } from "./places";
import { validBounds } from "./validation";
export const MAP_RECORD_LIMIT = 250;
const sql = (value: string) => "'" + value.replace(/'/g, "''") + "'";
const text = (value: unknown): string => typeof value === "string" ? value.trim().slice(0, 300) : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const color = (value: unknown, fallback: string) => Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(n => Number.isInteger(n) && n >= 0 && n <= 255)
  ? "#" + value.slice(0, 3).map(n => n.toString(16).padStart(2, "0")).join("") : fallback;
export function metadataStyle(data: Record<string, any>, layer: LayerDefinition) {
  const renderer = data.drawingInfo?.renderer;
  const entries: (MapLegendEntry & { value: string })[] = [];
  for (const info of Array.isArray(renderer?.uniqueValueInfos) ? renderer.uniqueValueInfos.slice(0, 32) : []) {
    const label = text(info.label); const value = text(info.value);
    if (label && value) entries.push({ label, value, color: color(info.symbol?.color, layer.color) });
  }
  const defaultColor = color(renderer?.symbol?.color, layer.color);
  return { entries, field: typeof renderer?.field1 === "string" ? renderer.field1 : layer.legendField,
    color: defaultColor, legend: entries.length ? entries.map(({ label, color }) => ({ label, color })) : [{ label: renderer?.symbol ? "Simbología publicada por UPME" : "Símbolo de la plataforma", color: defaultColor }] };
}
/** Solo geometrías WGS84 simples. Nunca sustituye una geometría ausente por un centro inventado. */
export function safeGeometry(value: unknown): MapGeometry | null {
  if (!value || typeof value !== "object") return null;
  const g = value as { type?: string; coordinates?: unknown };
  const ranks: Record<string, number> = { Point: 0, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 };
  if (!g.type || !Object.hasOwn(ranks, g.type)) return null;
  let positions = 0;
  function check(v: unknown, rank: number): boolean {
    if (!Array.isArray(v) || !v.length) return false;
    if (rank === 0) return ++positions <= 50000 && v.length === 2 && v.every(n => typeof n === "number" && Number.isFinite(n)) && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
    return v.length <= 50000 && v.every(child => check(child, rank - 1));
  }
  if (!check(g.coordinates, ranks[g.type]!)) return null;
  const coordinates = g.coordinates as any;
  const line = (value: number[][]) => value.length >= 2;
  const ring = (value: number[][]) => value.length >= 4 && value[0]![0] === value.at(-1)![0] && value[0]![1] === value.at(-1)![1];
  if (g.type === "LineString" && !line(coordinates) || g.type === "MultiLineString" && !coordinates.every(line)
    || g.type === "Polygon" && !coordinates.every(ring) || g.type === "MultiPolygon" && !coordinates.every((polygon: number[][][]) => polygon.every(ring))) return null;
  if (g.type === "Point") { const [lng, lat] = g.coordinates as number[]; if (lng! < -90 || lng! > -50 || lat! < -10 || lat! > 20) return null; }
  return { type: g.type, coordinates: g.coordinates } as MapGeometry;
}
function intersect(a: GeoBounds, b: GeoBounds): GeoBounds | null {
  const result: GeoBounds = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  return validBounds(result) ? result : null;
}
export function createGeographyService(options: { fetcher?: Fetcher; now?: () => number; timeoutMs?: number; recordLimit?: number } = {}) {
  const now = options.now || Date.now; const http = createGeoHttp(options.fetcher, now, options.timeoutMs);
  const recordLimit = Number.isInteger(options.recordLimit) ? Math.max(1, Math.min(MAP_RECORD_LIMIT, options.recordLimit!)) : MAP_RECORD_LIMIT;
  async function prepare(input: GeographyInput, signal?: AbortSignal) {
    const intent = mapIntent(input.q, input.category);
    const context: MapContext = { status: "none", message: intent.message, choices: intent.candidates.map(publicLayer), layer: null,
      place: null, placeChoices: [], bounds: null, departments: [], municipalities: [], technologies: [], technology: "", inferredTechnology: "", display: "vector", territorialMode: "none", legend: [], warnings: [] };
    if (!intent.candidates.length) return { context, definition: null, style: null, technologyValues: [] as string[] };
    if (input.layer && !intent.candidates.includes(input.layer)) throw new GeographyError(400, "Ese mapa no corresponde al tema de la búsqueda.");
    const id = input.layer || (intent.candidates.length === 1 ? intent.candidates[0] : undefined);
    if (!id) { context.status = "choice"; return { context, definition: null, style: null, technologyValues: [] as string[] }; }
    const definition = layers[id]; context.layer = publicLayer(id);
    const officialPlaces = await gazetteer(http, signal);
    if (officialPlaces.reference === "upme-2013") context.warnings.push("DANE no está disponible desde el servidor. Se utiliza la referencia territorial oficial de respaldo UPME, con vigencia declarada 2013 (DANE/IGAC). Puede no incluir municipios o límites recientes. Los datos energéticos conservan la vigencia de su propia capa.");
    context.departments = officialPlaces.departments;
    const location = resolvePlace(input, officialPlaces); context.place = location.place; context.placeChoices = location.choices;
    const department = location.place?.departmentCode || input.department;
    context.municipalities = officialPlaces.municipalities.filter(row => row.departmentCode === department).map(row => ({ code: row.municipalityCode!, name: row.municipality! })).sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (location.unresolved) {
      context.status = "place_choice"; context.message = location.choices.length ? "Hay varios territorios posibles en la consulta. Selecciona uno." : "No pudimos identificar un territorio oficial en la consulta. Selecciona departamento y municipio.";
      return { context, definition: null, style: null, technologyValues: [] as string[] };
    }
    if (location.place) context.bounds = await placeBounds(http, location.place, signal, officialPlaces.reference);
    const metadata = await http.json(UPME_REST + definition.path + "?f=json", signal, 1800000);
    const fields = new Set<string>((Array.isArray(metadata.fields) ? metadata.fields : []).map((f: { name: string }) => f.name));
    const expectedGeometry = { point: "esriGeometryPoint", line: "esriGeometryPolyline", polygon: "esriGeometryPolygon" }[definition.geometry];
    if (!String(metadata.capabilities).includes("Query") || metadata.geometryType !== expectedGeometry || permittedFields(definition).some(field => !fields.has(field)))
      throw new GeographyError(503, "La capa oficial cambió de estructura. Los resultados de búsqueda siguen disponibles.");
    const style = metadataStyle(metadata, definition); context.legend = style.legend;
    if (definition.supportsWms) {
      const extent = await http.json(UPME_REST + definition.path + "/query?" + new URLSearchParams({ f: "json", where: definition.oid + " IS NOT NULL", returnExtentOnly: "true", outSR: "4326" }), signal, 1800000);
      const e = extent.extent; const coverage = e ? [e.xmin, e.ymin, e.xmax, e.ymax] : null;
      if (!validBounds(coverage) || e.spatialReference?.wkid !== 4326) throw new GeographyError(503, "No pudimos verificar la cobertura de la capa temática.");
      context.coverageBounds = coverage;
    }
    let technologyValues: string[] = [];
    if (definition.technologyField) {
      const data = await http.json(UPME_REST + definition.path + "/query?" + new URLSearchParams({ f: "json", where: "1=1", outFields: definition.technologyField, returnGeometry: "false", returnDistinctValues: "true", orderByFields: definition.technologyField, resultRecordCount: "80" }), signal, 1800000);
      if (!Array.isArray(data.features) || data.exceededTransferLimit) throw new GeographyError(503, "No pudimos verificar las tecnologías de la capa oficial.");
      context.technologies = [...new Set<string>(data.features.map((f: any) => text(f.attributes?.[definition.technologyField!])).filter(Boolean))].sort();
      if (input.technology && input.technology !== "all" && !context.technologies.includes(input.technology)) throw new GeographyError(400, "La tecnología no está publicada en esta capa.");
      context.technology = input.technology || "";
      if (input.technology === "all") technologyValues = [];
      else if (input.technology) technologyValues = [input.technology];
      else if (intent.technology) {
        const terms: Record<string, string[]> = { solar: ["solar", "fotovoltaic"], eolica: ["eolic"], hidraulica: ["hidraulic", "hidro"], termica: ["termic"], biomasa: ["biomasa"] };
        technologyValues = context.technologies.filter(value => terms[intent.technology]!.some(term => normalize(value).includes(term)));
        context.inferredTechnology = intent.technology;
        if (!technologyValues.length) context.warnings.push("La fuente no publica recursos de la tecnología solicitada. No se sustituirán por otra tecnología.");
      }
    } else if (input.technology) throw new GeographyError(400, "Esta capa no admite filtro por tecnología.");
    context.territorialMode = location.place ? (definition.departmentField || definition.departmentCodeField ? "attributes" : "extent") : "none";
    if (context.territorialMode === "extent") context.warnings.push("Consulta espacial por la extensión rectangular de la referencia territorial oficial. Los elementos pueden cruzar límites municipales; no es un recorte administrativo exacto.");
    context.display = input.display || (definition.supportsWms && !location.place ? "wms" : "vector");
    if (context.display === "wms" && (!definition.supportsWms || location.place)) throw new GeographyError(400, "La vista WMS es panorámica nacional. Usa geometrías para consultar un territorio.");
    context.status = "ready";
    context.message = "Información geográfica complementaria de UPME; su conteo es independiente de Algolia.";
    return { context, definition, style, technologyValues };
  }
  async function features(input: GeographyInput, signal?: AbortSignal): Promise<MapData> {
    const { context, definition, style, technologyValues } = await prepare(input, signal);
    if (context.status !== "ready" || !definition || !style) throw new GeographyError(400, "Selecciona un mapa y un territorio no ambiguos.");
    const result: MapData = { type: "FeatureCollection", features: [], truncated: false, discarded: 0, limit: recordLimit, fetchedAt: new Date(now()).toISOString(), bounds: context.bounds, territorialMode: context.territorialMode };
    if (context.inferredTechnology && !technologyValues.length) return result;
    const bbox = input.bbox && context.bounds ? intersect(input.bbox, context.bounds) : input.bbox || context.bounds;
    if (input.bbox && context.bounds && !bbox) return result;
    const where: string[] = [];
    const place = context.place;
    if (place) {
      if (place.municipalityCode && definition.municipalityCodeField) where.push(definition.municipalityCodeField + "=" + sql(place.municipalityCode));
      else {
        if (definition.departmentCodeField) where.push(definition.departmentCodeField + "=" + sql(place.departmentCode));
        else if (definition.municipalityCodeField) where.push(definition.municipalityCodeField + " LIKE " + sql(place.departmentCode + "%"));
        else if (definition.departmentField) where.push("UPPER(" + definition.departmentField + ") IN (" + [...new Set([place.department.toUpperCase(), normalize(place.department).toUpperCase()])].map(sql).join(",") + ")");
        if (place.municipality && definition.municipalityField) where.push("UPPER(" + definition.municipalityField + ") IN (" + [...new Set([place.municipality.toUpperCase(), normalize(place.municipality).toUpperCase()])].map(sql).join(",") + ")");
      }
    }
    if (technologyValues.length && definition.technologyField) where.push(definition.technologyField + " IN (" + technologyValues.map(sql).join(",") + ")");
    const params = new URLSearchParams({ f: "geojson", where: where.join(" AND ") || "1=1", outFields: permittedFields(definition).join(","), outSR: "4326", returnGeometry: "true", resultRecordCount: String(recordLimit), orderByFields: definition.oid, geometryPrecision: "5" });
    if (definition.geometry !== "point") params.set("maxAllowableOffset", "0.001");
    if (bbox) { params.set("geometry", bbox.join(",")); params.set("geometryType", "esriGeometryEnvelope"); params.set("inSR", "4326"); params.set("spatialRel", "esriSpatialRelIntersects"); }
    const data = await http.json(UPME_REST + definition.path + "/query?" + params, signal);
    if (data.type !== "FeatureCollection" || !Array.isArray(data.features) || data.features.length > recordLimit) throw new GeographyError(503, "La fuente devolvió una respuesta geográfica inesperada.");
    result.truncated = data.exceededTransferLimit === true || data.features.length === recordLimit;
    for (const feature of data.features) {
      const geometry = safeGeometry(feature.geometry); const attributes = feature.properties;
      const shapeMatches = geometry && (definition.geometry === "point" ? geometry.type === "Point" : definition.geometry === "line" ? ["LineString", "MultiLineString"].includes(geometry.type) : ["Polygon", "MultiPolygon"].includes(geometry.type));
      const id = attributes && text(attributes[definition.oid]);
      if (!geometry || !shapeMatches || !id) { result.discarded++; continue; }
      const facts = definition.facts.flatMap(field => {
        const value = attributes[field.field];
        const formatted = field.date && typeof value === "number" && value > 0 && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString().slice(0, 10) : text(value);
        return formatted ? [{ label: field.label, value: formatted }] : [];
      });
      if (geometry.type === "Point") facts.push({ label: "Coordenadas oficiales (latitud, longitud)", value: geometry.coordinates[1] + ", " + geometry.coordinates[0] });
      const chosenColor = style.entries.find(entry => entry.value === text(attributes[style.field || ""]))?.color || style.color;
      const clean: MapFeature = { type: "Feature", id: definition.id + ":" + id, geometry, properties: { title: text(attributes[definition.nameField]) || definition.title, facts, color: chosenColor } };
      result.features.push(clean);
    }
    return result;
  }
  return {
    async availability(signal?: AbortSignal) {
      const sources = await Promise.all(([ ["DANE", DANE_BASE], ["UPME", UPME_REST + layers.communities.path] ] as const).map(async ([source, url]) => {
        try { await http.json(url + "?f=json", signal, 300000); return { source, available: true }; }
        catch (error) { return { source, available: false, ...(error instanceof GeographyError && error.diagnostic ? { diagnostic: error.diagnostic } : {}) }; }
      }));
      return { sources, checkedAt: new Date(now()).toISOString() };
    },
    context: async (input: GeographyInput, signal?: AbortSignal) => (await prepare(input, signal)).context,
    features,
    async wms(input: GeographyInput, signal?: AbortSignal) {
      const { context, definition } = await prepare(input, signal);
      if (context.status !== "ready" || !definition?.wmsPath || context.display !== "wms" || !input.bbox) throw new GeographyError(400, "La vista WMS no está disponible con esos filtros.");
      const bounds = context.coverageBounds ? intersect(input.bbox, context.coverageBounds) : null;
      if (!bounds) throw new GeographyError(404, "No hay cobertura de esta capa temática en el área visible.");
      // Imagen en la proyección de Leaflet. Los encuadres públicos siguen en WGS84.
      const r = 6378137;
      const x = (longitude: number) => r * longitude * Math.PI / 180;
      const y = (latitude: number) => r * Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
      const mercator = [x(bounds[0]), y(bounds[1]), x(bounds[2]), y(bounds[3])];
      // WMS usa el nombre publicado 0, distinto del ID de capa REST 3/10. No se aceptan URLs ni estilos externos.
      const url = "https://geo.upme.gov.co/server/services/" + definition.wmsPath + "/MapServer/WMSServer?" + new URLSearchParams({ service: "WMS", version: "1.1.1", request: "GetMap", layers: "0", styles: "", srs: "EPSG:3857", bbox: mercator.join(","), width: "640", height: "480", format: "image/png", transparent: "true" });
      return { bytes: await http.image(url, signal), bounds };
    },
  };
}
export type GeographyService = ReturnType<typeof createGeographyService>;
export const geographyService = createGeographyService();
