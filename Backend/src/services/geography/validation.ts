import { MAP_LAYERS, type GeographyInput, type GeoBounds } from "../../../../shared/geography";
import { TOPIC_OPTIONS } from "../../../../shared/preferences";
import { GeographyError } from "./http";
const invalid = () => new GeographyError(400, "Revisa la consulta y los filtros del mapa.");
export function validBounds(value: unknown): value is GeoBounds {
  return Array.isArray(value) && value.length === 4 && value.every(n => typeof n === "number" && Number.isFinite(n))
    && value[0] >= -180 && value[2] <= 180 && value[1] >= -85 && value[3] <= 85
    && value[0] < value[2] && value[1] < value[3] && value[2] - value[0] <= 100 && value[3] - value[1] <= 80;
}
export function validateGeography(query: Record<string, unknown>, image = false): GeographyInput {
  const allowed = new Set(["q", "category", "layer", "department", "municipality", "technology", "display", "bbox"]);
  if (Object.keys(query).some(key => !allowed.has(key)) || Object.values(query).some(value => typeof value !== "string")) throw invalid();
  const q = String(query.q || "").trim(); if (q.length > 180 || /[\x00-\x1f]/.test(q)) throw invalid();
  if (query.category && !TOPIC_OPTIONS.some(topic => topic.id === query.category)) throw invalid();
  if (query.layer && !MAP_LAYERS.includes(query.layer as typeof MAP_LAYERS[number])) throw invalid();
  if (query.department && !/^\d{2}$/.test(String(query.department))) throw invalid();
  if (query.municipality && !/^\d{5}$/.test(String(query.municipality))) throw invalid();
  if (query.technology && (String(query.technology).length > 90 || /[\x00-\x1f<>]/.test(String(query.technology)))) throw invalid();
  if (query.display && query.display !== "vector" && query.display !== "wms") throw invalid();
  const bbox = query.bbox ? String(query.bbox).split(",").map(Number) : undefined;
  if ((bbox && !validBounds(bbox)) || (image && !bbox)) throw invalid();
  return { q, ...(query.category ? { category: String(query.category) } : {}), ...(query.layer ? { layer: query.layer as GeographyInput["layer"] } : {}),
    ...(query.department ? { department: String(query.department) } : {}), ...(query.municipality ? { municipality: String(query.municipality) } : {}),
    ...(query.technology ? { technology: String(query.technology) } : {}), ...(query.display ? { display: query.display as GeographyInput["display"] } : {}), ...(bbox ? { bbox: bbox as GeoBounds } : {}) };
}
