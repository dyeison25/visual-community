import { apiRequest } from "./api";
import { publicMinistryUrl,normalizeMinistryUrl } from "../../../shared/officialSources";
import type { Source } from "../../../shared/models";
export async function resolveSourceUrl(url:string,source:Source):Promise<string>{
  if(source!=="MinEnergía")return url;
  const response=await apiRequest("/energy/ministry-source?"+new URLSearchParams({url:normalizeMinistryUrl(url)})) as {url?:unknown};
  if(!publicMinistryUrl(response.url))throw Error("La fuente oficial no está disponible en este momento. Puedes consultar el detalle aquí.");
  return response.url;
}
