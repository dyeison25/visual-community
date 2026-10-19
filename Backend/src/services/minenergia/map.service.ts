import type { EnergyCommunity, SourceResult } from "../../../../shared/models";
import { cached, fetchJson, officialBase, record, type Fetcher } from "../external/http";
import { MINENERGIA_PAGE, parseCommunities } from "./minenergia.service";
import { resolveMinistryUrl } from "./public-links.service";
export const LAYER = "https://arcgisenterprise.minenergia.gov.co/server/rest/services/Comunidades_Energ%C3%A9ticas/MapServer/0";
/** Lee la capa por lotes de objectIds; nunca solicita campos personales. */
export async function loadMap(fetcher?: Fetcher): Promise<EnergyCommunity[]> {
  const layer = officialBase(process.env.MINENERGIA_LAYER_URL || LAYER, "arcgisenterprise.minenergia.gov.co");
  const query = (params: Record<string,string>) => layer + "/query?" + new URLSearchParams({ f:"json", ...params });
  const raw = record(await fetchJson(query({ where:"1=1", returnIdsOnly:"true" }), {}, fetcher));
  if (!Array.isArray(raw.objectIds) || !raw.objectIds.every(Number.isSafeInteger)) throw Error("Invalid ids");
  const ids = [...new Set(raw.objectIds as number[])].sort((a,b)=>a-b);
  if (ids.length > 100000) throw Error("Layer too large");
  const rows: EnergyCommunity[] = [];
  for (let start=0; start<ids.length; start+=6000) {
    const batches = [0,2000,4000].map(offset=>ids.slice(start+offset,start+offset+2000)).filter(batch=>batch.length);
    const results = await Promise.all(batches.map(async batch=>{
      const value = record(await fetchJson(layer + "/query", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({ f:"json", objectIds:batch.join(","), outFields:"FID,Nombre_de_,Departamen,Municipio,Estado,Rural___Ur,Operador_d,Ejecutor", returnGeometry:"true",outSR:"4326" }) },fetcher));
      if (value.exceededTransferLimit) throw Error("Incomplete batch");
      return parseCommunities(value);
    }));
    rows.push(...results.flat());
  }
  if (new Set(rows.map(row=>row.id)).size !== ids.length) throw Error("Incomplete layer");
  return rows;
}
export async function getCommunityMap(): Promise<SourceResult<EnergyCommunity[]>> {
  try { const rows=await cached("min:map",()=>loadMap(),900000);
    const url=await resolveMinistryUrl();const data=rows.map(row=>({...row,sourceUrl:url||""}));
    return { data, source:"MinEnergía",sourceUrl:MINENERGIA_PAGE,status:data.length?"ok":"empty",fetchedAt:new Date().toISOString(),message:"Registros oficiales, incluidas postulaciones. No equivale a proyectos ejecutados." };
  } catch { return { data:[],source:"MinEnergía",sourceUrl:MINENERGIA_PAGE,status:"unavailable",fetchedAt:new Date().toISOString(),message:"El mapa no está disponible temporalmente. Puedes seguir consultando las demás secciones." }; }
}
