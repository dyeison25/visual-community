import type { CommunityData, EnergyCommunity, SourceResult } from "../../../../shared/models";
import { cached, fetchJson, officialBase, record, type Fetcher } from "../external/http";
import { MINISTRY_COMMUNITIES_PAGE } from "../../../../shared/officialSources";
import { resolveMinistryUrl } from "./public-links.service";
export const MINENERGIA_PAGE = MINISTRY_COMMUNITIES_PAGE;
//SERVICIO OFICIAL 
const defaultLayer = "https://arcgisenterprise.minenergia.gov.co/server/rest/services/Comunidades_Energ%C3%A9ticas/MapServer/0";
function text(value: unknown, fallback: string) { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
/**
 * Convierte los registros geográficos del Ministerio al formato de la plataforma.
 * Conserva nombre, departamento, municipio, estado, ubicación válida y enlace original.
 * Si faltan datos, usa textos aclaratorios o null; no incorpora los campos personales de la capa.
 */
export function parseCommunities(value: unknown): EnergyCommunity[] {
  const root = record(value);
  if (!Array.isArray(root.features)) throw new Error("Capa inesperada");
  return root.features.map((feature: unknown) => {
    const row = record(feature); const a = record(row.attributes);
    if (typeof a.FID !== "number" || !Number.isInteger(a.FID)) throw new Error("Identificador inesperado");
    const geometry = row.geometry ? record(row.geometry) : {};
    const valid = typeof geometry.x === "number" && typeof geometry.y === "number" && Math.abs(geometry.x) <= 180 && Math.abs(geometry.y) <= 90;
    return { id: String(a.FID), name: text(a.Nombre_de_, "Comunidad sin nombre publicado"),
      department: text(a.Departamen, "Sin departamento"), municipality: text(a.Municipio, "Sin municipio"),
      status: typeof a.Estado === "string" && a.Estado.trim() ? a.Estado.trim() : null,
      longitude: valid ? geometry.x as number : null, latitude: valid ? geometry.y as number : null,
      area: typeof a.Rural___Ur === "string" ? a.Rural___Ur.trim().slice(0, 200) || null : null,
      operator: typeof a.Operador_d === "string" ? a.Operador_d.trim().slice(0, 200) || null : null,
      executor: typeof a.Ejecutor === "string" ? a.Ejecutor.trim().slice(0, 200) || null : null,
      // La capa no publica una página individual verificada. El enlace visible es institucional.
      source: "MinEnergía" as const, sourceUrl: MINENERGIA_PAGE };
  });
}
/**
 * Prepara el filtro de búsqueda por nombre, departamento o municipio.
 * Limita el texto, quita comodines y escapa comillas para construir la consulta de ArcGIS.
 * Si no hay texto, devuelve 1=1, que significa consultar todos los registros.
 */
export function communityWhere(search: string) {
  const safe = search.trim().slice(0, 80).toUpperCase().replace(/[%_]/g, "").replace(/'/g, "''");
  return safe ? "(UPPER(Nombre_de_) LIKE '%" + safe + "%' OR UPPER(Departamen) LIKE '%" + safe + "%' OR UPPER(Municipio) LIKE '%" + safe + "%')" : "1=1";
}

//Se utiliza el servicio oficial de MinEnergia 
/**
 * Consulta el servicio geográfico oficial de MinEnergía y devuelve hasta 24 comunidades.
 * Primero obtiene los identificadores que coinciden con search; luego pide los de esta página.
 * offset indica cuántos resultados saltar. La capa usa objectIds porque no admite resultOffset.
 * Conserva resultados durante 15 minutos y, si la fuente falla, devuelve un estado comprensible.
 * Los registros pueden ser postulaciones: no representan necesariamente proyectos ejecutados.
 */
export async function getCommunities(offset = 0, search = "", fetcher?: Fetcher): Promise<SourceResult<CommunityData>> {
  const source = "MinEnergía" as const;
  try {
    const layer = officialBase(process.env.MINENERGIA_LAYER_URL || defaultLayer, "arcgisenterprise.minenergia.gov.co");
    const query = (params: Record<string, string>) => layer + "/query?" + new URLSearchParams({ f: "json", ...params });
    const where = communityWhere(search);
    const loadIds = async () => {
      const raw = record(await fetchJson(query({ where, returnIdsOnly: "true" }), {}, fetcher));
      if (raw.objectIdFieldName !== "FID" || !Array.isArray(raw.objectIds) || !raw.objectIds.every(id => Number.isSafeInteger(id))) throw new Error("Índice externo inesperado");
      return (raw.objectIds as number[]).sort((a, b) => a - b);
    };
    // La capa NO soporta resultOffset. Se pagina mediante sus objectIds oficiales.
    const ids = await (fetcher ? loadIds() : cached("min:ids:" + where, loadIds, 900000));
    const selected = ids.slice(offset, offset + 24);
    const loadRows = async () => selected.length ? parseCommunities(await fetchJson(query({
      objectIds: selected.join(","), outFields: "FID,Nombre_de_,Departamen,Municipio,Estado,Rural___Ur,Operador_d,Ejecutor",
      returnGeometry: "true", outSR: "4326",
    }), {}, fetcher)) : [];
    const communities = await (fetcher ? loadRows() : cached("min:rows:" + selected.join(","), loadRows, 900000));
    const verifiedUrl = fetcher ? MINENERGIA_PAGE : await resolveMinistryUrl();
    for (const community of communities) community.sourceUrl = verifiedUrl || "";
    return { source, sourceUrl: MINENERGIA_PAGE, fetchedAt: new Date().toISOString(), status: communities.length ? "ok" : "empty",
      data: { communities, total: ids.length, hasMore: offset + 24 < ids.length, offset },
      message: "Registros de la capa pública de MinEnergía. Incluye postulaciones; no equivale al número de proyectos ejecutados ni al Registro de Comunidades Energéticas (RCE)." };
  } catch {
    return { source, sourceUrl: MINENERGIA_PAGE, status: "unavailable", fetchedAt: new Date().toISOString(),
      data: { communities: [], total: null, hasMore: false, offset }, message: "El servicio geográfico de MinEnergía no está disponible en este momento. Puedes consultar el portal oficial o volver a intentar." };
  }
}
