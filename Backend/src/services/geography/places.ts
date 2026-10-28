import type { GeographyInput, GeoPlace, GeoBounds } from "../../../../shared/geography";
import { DANE_BASE } from "./catalog";
import { GeographyError, type GeoHttp } from "./http";
import { normalize } from "./intent";
import { validBounds } from "./validation";
export type Gazetteer = { departments: { code: string; name: string }[]; municipalities: GeoPlace[] };
/** Elimina solo menciones contenidas en otro nombre, no territorios distintos de una consulta. */
function namedPlaces<T>(query: string, rows: T[], key: (row: T) => string, names: (row: T) => string[]): T[] {
  const text = " " + query + " ";
  const occurrences = rows.flatMap(row => names(row).flatMap(name => {
    const phrase = " " + normalize(name) + " "; const matches: { row: T; start: number; end: number }[] = [];
    for (let position = text.indexOf(phrase); position >= 0; position = text.indexOf(phrase, position + 1)) matches.push({ row, start: position, end: position + phrase.length });
    return matches;
  }));
  const visible = occurrences.filter(match => !occurrences.some(other => key(other.row) !== key(match.row) && other.start <= match.start && other.end >= match.end && other.end - other.start > match.end - match.start));
  return [...new Map(visible.map(match => [key(match.row), match.row])).values()];
}
const fields = "DPTO_CCDGO,MPIO_CDPMP,DPTO_CNMBRE,MPIO_CNMBRE";
export async function gazetteer(http: GeoHttp, signal?: AbortSignal): Promise<Gazetteer> {
  // Referencia administrativa ligera: solo códigos y nombres, sin geometrías ni datos de personas.
  const data = await http.json(DANE_BASE + "/317/query?" + new URLSearchParams({ f: "json", where: "MPIO_CDPMP IS NOT NULL", outFields: fields, returnGeometry: "false" }), signal, 86_400_000);
  if (!Array.isArray(data.features) || !data.features.length || data.features.length > 2000 || data.exceededTransferLimit) throw new GeographyError(503, "No pudimos verificar el catálogo territorial oficial. Intenta nuevamente.");
  const municipalities: GeoPlace[] = []; const departments = new Map<string, string>();
  for (const feature of data.features) {
    const a = feature.attributes;
    if (!a || !/^\d{2}$/.test(a.DPTO_CCDGO) || !/^\d{5}$/.test(a.MPIO_CDPMP) || typeof a.DPTO_CNMBRE !== "string" || typeof a.MPIO_CNMBRE !== "string") throw new GeographyError(503, "El catálogo territorial oficial cambió de formato.");
    municipalities.push({ departmentCode: a.DPTO_CCDGO, department: a.DPTO_CNMBRE.slice(0, 100), municipalityCode: a.MPIO_CDPMP, municipality: a.MPIO_CNMBRE.slice(0, 100) });
    departments.set(a.DPTO_CCDGO, a.DPTO_CNMBRE.slice(0, 100));
  }
  return { departments: [...departments].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, "es")), municipalities };
}
export function resolvePlace(input: GeographyInput, data: Gazetteer): { place: GeoPlace | null; choices: GeoPlace[]; unresolved: boolean } {
  const q = normalize(input.q);
  let department = input.department ? data.departments.find(row => row.code === input.department) : undefined;
  if (input.department && !department) throw new GeographyError(400, "El departamento no existe en el catálogo oficial.");
  if (input.municipality) {
    const place = data.municipalities.find(row => row.municipalityCode === input.municipality && (!department || row.departmentCode === department.code));
    if (!place) throw new GeographyError(400, "El municipio no corresponde al departamento seleccionado.");
    return { place, choices: [], unresolved: false };
  }
  if (input.department && department) return { place: { departmentCode: department.code, department: department.name }, choices: [], unresolved: false };
  const departmentMatches = namedPlaces(q, data.departments, row => row.code, row => row.code === "11" ? [row.name, "Bogotá"] : [row.name]);
  if (departmentMatches.length > 1) return { place: null, choices: departmentMatches.map(row => ({ departmentCode: row.code, department: row.name })), unresolved: true };
  if (!department && departmentMatches.length === 1) department = departmentMatches[0];
  let municipalities = namedPlaces(q, data.municipalities, row => row.municipalityCode!, row => [row.municipality!]);
  if (department && municipalities.length) {
    const inside = municipalities.filter(row => row.departmentCode === department.code);
    if (!inside.length) return { place: null, choices: [{ departmentCode: department.code, department: department.name }, ...municipalities].slice(0, 30), unresolved: true };
    municipalities = inside;
  }
  if (municipalities.length === 1) return { place: municipalities[0]!, choices: [], unresolved: false };
  if (municipalities.length > 1) return { place: null, choices: municipalities.slice(0, 30), unresolved: true };
  if (department) return { place: { departmentCode: department.code, department: department.name }, choices: [], unresolved: false };
  const explicitUnknown = /\ben\s+(?!colombia\b|el pais\b|todo el pais\b|general\b)[a-z]/.test(q);
  return { place: null, choices: [], unresolved: explicitUnknown };
}
export async function placeBounds(http: GeoHttp, place: GeoPlace, signal?: AbortSignal): Promise<GeoBounds> {
  const layer = place.municipalityCode ? "317" : "319";
  const where = place.municipalityCode ? "MPIO_CDPMP='" + place.municipalityCode + "'" : "DPTO_CCDGO='" + place.departmentCode + "'";
  const data = await http.json(DANE_BASE + "/" + layer + "/query?" + new URLSearchParams({ f: "json", where, returnExtentOnly: "true", outSR: "4326" }), signal, 86_400_000);
  const e = data.extent; const bbox = e ? [e.xmin, e.ymin, e.xmax, e.ymax] : null;
  if (!validBounds(bbox) || e.spatialReference?.wkid !== 4326) throw new GeographyError(503, "La fuente no devolvió un encuadre territorial verificable.");
  return bbox;
}
