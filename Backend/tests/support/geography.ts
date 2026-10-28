// Respuestas sintéticas exclusivamente para pruebas. Nunca se usan como fallback de producción.
import type { Fetcher } from "../../src/services/external/http";
import { layers, permittedFields } from "../../src/services/geography/catalog";
import type { MapLayerId } from "../../../shared/geography";
export const placeFixtures = [
  { DPTO_CCDGO: "05", MPIO_CDPMP: "05001", DPTO_CNMBRE: "ANTIOQUIA", MPIO_CNMBRE: "MEDELLÍN" },
  { DPTO_CCDGO: "44", MPIO_CDPMP: "44847", DPTO_CNMBRE: "LA GUAJIRA", MPIO_CNMBRE: "URIBIA" },
  { DPTO_CCDGO: "13", MPIO_CDPMP: "13683", DPTO_CNMBRE: "BOLÍVAR", MPIO_CNMBRE: "SANTA ROSA" },
  { DPTO_CCDGO: "19", MPIO_CDPMP: "19701", DPTO_CNMBRE: "CAUCA", MPIO_CNMBRE: "SANTA ROSA" },
  { DPTO_CCDGO: "76", MPIO_CDPMP: "76001", DPTO_CNMBRE: "VALLE DEL CAUCA", MPIO_CNMBRE: "CALI" },
  { DPTO_CCDGO: "68", MPIO_CDPMP: "68001", DPTO_CNMBRE: "SANTANDER", MPIO_CNMBRE: "BUCARAMANGA" },
  { DPTO_CCDGO: "54", MPIO_CDPMP: "54001", DPTO_CNMBRE: "NORTE DE SANTANDER", MPIO_CNMBRE: "CÚCUTA" },
];
export const fixtureBounds = [-76, 5, -74, 7];
export function geographicFixture() {
  const calls: URL[] = [];
  const fetcher: Fetcher = async (input, options) => {
    options?.signal?.throwIfAborted(); const url = new URL(String(input)); calls.push(url);
    if (url.hostname === "geoportal.dane.gov.co") return Response.json(url.searchParams.has("returnExtentOnly") ? { extent: { xmin: -76, ymin: 5, xmax: -74, ymax: 7, spatialReference: { wkid: 4326 } } } : { features: placeFixtures.map(attributes => ({ attributes })) });
    if (url.pathname.endsWith("WMSServer")) return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]), { headers: { "content-type": "image/png" } });
    const definition = Object.values(layers).find(layer => url.pathname.includes(layer.path));
    if (!definition) throw Error("La prueba no permite acceso a red real ni rutas ajenas al catálogo.");
    if (url.searchParams.has("returnExtentOnly")) return Response.json({ extent: { xmin: -76, ymin: 5, xmax: -74, ymax: 7, spatialReference: { wkid: 4326 } } });
    if (!url.pathname.endsWith("/query")) return Response.json({ capabilities: "Map,Query,Data", geometryType: { point: "esriGeometryPoint", line: "esriGeometryPolyline", polygon: "esriGeometryPolygon" }[definition.geometry], fields: permittedFields(definition).map(name => ({ name })), drawingInfo: { renderer: { type: "simple", symbol: { color: [49, 92, 68, 255] } } } });
    if (url.searchParams.has("returnDistinctValues")) return Response.json({ features: ["SOLAR", "EOLICA", "HIDRAULICA"].map(value => ({ attributes: { [definition.technologyField!]: value } })) });
    return Response.json(featureFixture(definition.id));
  };
  return { calls, fetcher };
}
export function featureFixture(id: MapLayerId) {
  const layer = layers[id];
  const ring = [[-75, 6], [-74.99, 6], [-74.99, 6.01], [-75, 6]];
  return { type: "FeatureCollection", features: [{ type: "Feature", geometry: layer.geometry === "point" ? { type: "Point", coordinates: [-75, 6] }
    : layer.geometry === "line" ? { type: "LineString", coordinates: ring.slice(0, 2) } : { type: "Polygon", coordinates: [ring] },
    properties: { [layer.oid]: 1, [layer.nameField]: "Registro sintético de prueba", CEDULA: "no-publicar-identificacion", CORREO_E_1: "private@example.invalid", [layer.facts[0]!.field]: "ANTIOQUIA" } }] };
}
