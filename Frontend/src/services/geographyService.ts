import { auth } from "../config/firebase";
import type { GeographyInput, GeoBounds, MapContext, MapData } from "../../../shared/geography";
export function geographyParams(input: GeographyInput) {
  const params = new URLSearchParams({ q: input.q });
  for (const key of ["category", "layer", "department", "municipality", "technology", "display"] as const) if (input[key]) params.set(key, input[key]!);
  if (input.bbox) params.set("bbox", input.bbox.join(","));
  return params;
}
async function request(path: string, input: GeographyInput, signal: AbortSignal) {
  const user = auth?.currentUser; if (!user) throw Error("Inicia sesión para consultar el mapa.");
  signal.throwIfAborted();
  const response = await fetch((import.meta.env.VITE_API_BASE_URL || "/api") + "/geography/" + path + "?" + geographyParams(input), {
    headers: { Authorization: "Bearer " + await user.getIdToken() }, signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]),
  });
  if (!response.ok) { const data = await response.json().catch(() => null); throw Error(data?.message || "No pudimos consultar el mapa oficial."); }
  return response;
}
async function json(response: Response): Promise<any> {
  try { return await response.json(); } catch { throw Error("La respuesta del mapa no tiene un formato válido. Intenta nuevamente."); }
}
export const geographyService = {
  context: async (input: GeographyInput, signal: AbortSignal): Promise<MapContext> => {
    const data = await json(await request("context", input, signal));
    if (!data || !["none", "choice", "place_choice", "ready"].includes(data.status) || typeof data.message !== "string"
      || ["choices", "departments", "municipalities", "technologies", "placeChoices", "legend", "warnings"].some(key => !Array.isArray(data[key]))) throw Error("La respuesta del mapa no tiene el formato esperado.");
    return data;
  },
  features: async (input: GeographyInput, signal: AbortSignal): Promise<MapData> => {
    const data = await json(await request("features", input, signal));
    if (data?.type !== "FeatureCollection" || !Array.isArray(data.features) || data.features.length > 250
      || data.features.some((row: any) => !row?.geometry || !Array.isArray(row.geometry.coordinates) || typeof row.id !== "string" || typeof row.properties?.title !== "string" || !Array.isArray(row.properties.facts))) throw Error("La capa devolvió geometrías con un formato inesperado.");
    return data;
  },
  wms: async (input: GeographyInput, signal: AbortSignal): Promise<{ blob: Blob; bounds: GeoBounds }> => {
    const response = await request("wms", input, signal);
    if (!response.headers.get("content-type")?.startsWith("image/png")) throw Error("La capa visual no está disponible. Prueba la vista de geometrías.");
    const bounds = response.headers.get("X-Map-Bounds")?.split(",").map(Number);
    if (!bounds || bounds.length !== 4 || bounds.some(n => !Number.isFinite(n)) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) throw Error("No pudimos verificar el encuadre de la imagen oficial.");
    return { blob: await response.blob(), bounds: bounds as GeoBounds };
  },
};
