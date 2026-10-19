import type { EnergyContent } from "../../../../shared/discovery";
import { algoliaConfig, normalizeHitLinks, validHit } from "./algolia.service";
import { normalizeIndexRecord } from "./indexSchema";
import { cached } from "../external/http";
type Reference={contentId?:string;source?:string};
export function eventObjectID(event:Reference):string|null {
  if(!event.contentId||event.contentId.length>120)return null;
  if(event.source==="MinEnergía"&&/^\d+$/.test(event.contentId))return "community:"+event.contentId;
  if(event.source==="XM"&&["Gene","DemaReal","PrecBolsNaci"].includes(event.contentId))return "metric:"+event.contentId;
  if((event.source==="CREG"&&event.contentId.startsWith("creg-"))||(event.source==="MinEnergía"&&event.contentId.startsWith("min-")))return "article:"+event.contentId;
  return null;
}
/** Una petición por lote, máximo 50 contenidos públicos distintos del historial reciente. */
export async function historyContents(events:Reference[]):Promise<EnergyContent[]> {
  const ids=[...new Set(events.map(eventObjectID).filter((id):id is string=>id!==null))].slice(0,50).sort();
  if(!ids.length)return [];
  try {
    const connection=algoliaConfig();
    return await cached("algolia:history:"+process.env.ALGOLIA_APP_ID+":"+connection.indexName+":"+ids.join(","),async()=>{
      const result=await connection.client.getObjects({requests:ids.map(objectID=>({indexName:connection.indexName,objectID}))});
      return result.results.map(normalizeIndexRecord).filter(validHit).map(normalizeHitLinks);
    },60000);
  }catch{return [];} // Si Algolia falla, siguen disponibles preferencias y categorías registradas.
}
