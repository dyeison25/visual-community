import type { MapLayerId } from "../../../../shared/geography";
import { inferTopics } from "../../../../shared/preferences";
export const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const contains = (text: string, phrase: string) => (" " + text + " ").includes(" " + phrase + " ");
/** Reglas explicables: la entidad consultada tiene prioridad sobre el adjetivo solar/eólico. */
export function mapIntent(query: string, category = ""): { candidates: MapLayerId[]; technology: string; message: string } {
  const q = normalize(query); const topics = inferTopics(query);
  const has = (pattern: RegExp) => pattern.test(q);
  if (has(/\b(normativa|regulacion|resoluciones?|decretos?|ley|leyes|noticias?|precio|precios|bolsa|mercado|demanda|consumo)\b/)
    || has(/\b(como instalar|como funciona|que es|que son|definicion|curso|tutorial)\b/))
    return { candidates: [], technology: "", message: "Esta consulta no solicita una representación geográfica." };
  const solar = has(/\b(solar|solares|fotovoltaic[oa]s?)\b/);
  const wind = has(/\b(eolic[oa]s?|viento|vientos)\b/);
  const technology = solar ? "solar" : wind ? "eolica" : has(/\bhidraulic[oa]s?\b/) ? "hidraulica" : has(/\btermic[oa]s?\b/) ? "termica" : has(/\bbiomasa\b/) ? "biomasa" : "";
  const candidates: MapLayerId[] = [];
  const project = has(/\b(proyectos?|plantas?|parques?|generacion|generadoras?|central|centrales)\b/);
  if (has(/\bcomunidad(?:es)?\b/)) candidates.push("communities");
  if (has(/\bcapacidad asignada\b|\bpuntos? de conexion\b|\basignacion de capacidad\b/)) candidates.push("connection");
  if (has(/\bsubestacion(?:es)?\b/)) candidates.push("substations");
  if (has(/\btransmision\b|\blineas? electricas?\b/)) candidates.push("transmission");
  if (has(/\bradiacion\b|\birradiacion\b/) || solar && has(/\bpotencial(?:es)?\b|\brecursos?\b/)) candidates.push("solar");
  if (wind && (has(/\bpotencial(?:es)?\b|\brecursos?\b|\bdensidad\b/) || !project && !candidates.length && has(/\benergia eolica\b/))) candidates.push("wind");
  if (project && (!candidates.length || has(/\bgeneracion\b|\bplantas?\b|\bparques?\b|\bcentral\b|\bcentrales\b/))) candidates.push("generation");
  if (!candidates.length && has(/\binfraestructura\b|\bred(?:es)? electricas?\b/)) candidates.push("substations", "transmission");
  if (!candidates.length && q && (topics.includes("renewable_energy") || solar || wind || has(/\bpotencial\b/))) {
    if (solar && !wind) candidates.push("solar", "generation");
    else if (wind && !solar) candidates.push("wind", "generation");
    else candidates.push("solar", "wind", "generation");
  }
  if (!q && category === "energy_communities") candidates.push("communities");
  if (!q && category === "generation") candidates.push("generation");
  if (!q && category === "renewable_energy") candidates.push("solar", "wind", "generation");
  if (!q && category === "energy_projects") candidates.push("generation", "connection", "transmission");
  const unique = [...new Set(candidates)];
  return { candidates: unique, technology, message: unique.length > 1 ? "Hay varios mapas relacionados. Selecciona cuál deseas consultar." : unique.length ? "Mapa seleccionado según el tema de tu búsqueda." : "No identificamos un mapa pertinente para esta consulta." };
}
