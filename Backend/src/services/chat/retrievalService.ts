import type { ChatTurn, EnergyContent } from "../../../../shared/discovery";
import { getInterestProfile, detectTopics } from "../discovery/interest.service";
import { selectLocalContext } from "./localRetrieval";
import { buildCatalog } from "../discovery/catalog.service";
import { cached } from "../external/http";
import { normalizeHitLinks } from "../discovery/algolia.service";
import { searchIndex } from "../discovery/algolia.service";
import { getXmMetrics } from "../xm/xm.service";
export function retrievalQuery(question:string,history:ChatTurn[]):string {
  const previous=[...history].reverse().find(turn=>turn.role==="user")?.content||"";
  const followup=/^(y |cuales|cuáles|esas|esos|ellos|ellas|¿cuáles|¿y |mas |más )/i.test(question.trim()) || question.trim().split(/\s+/).length<5;
  if (/^(¿?que informacion nueva hay\??|¿?qué información nueva hay\??|novedades|noticias nuevas)$/i.test(question.trim()))return "";
  return ((followup?previous+" ":"")+question).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/[¿?¡!.,;:]/g," ").split(/\s+/)
    .filter(word=>!["que","es","una","un","el","la","los","las","de","del","en","hay","sobre","me","muestrame","cual","cuales","por","favor","informacion","plataforma","disponible"].includes(word)).join(" ").slice(0,180);
}
/** Recupera como máximo cinco resúmenes. No envía perfiles ni historiales de actividad al proveedor del asistente. */
export async function retrieve(uid:string,question:string,history:ChatTurn[]):Promise<{sources:EnergyContent[];category?:string}>{
  const profile=await getInterestProfile(uid);
  let sources:EnergyContent[]=[];
  try {
    const result=await searchIndex(retrievalQuery(question,history),profile,{limit:15});
    sources=selectLocalContext(result.hits,question,history,profile);
  } catch { /* Algolia opcional: conservamos recuperación con servicios oficiales existentes. */ }
  if(!sources.length){
    const catalog=await cached("chat:official-catalog",()=>buildCatalog(true),300000);
    sources=selectLocalContext(catalog.contents,question,history,profile);
  }
  sources=sources.map(normalizeHitLinks);
  if(sources.some(source=>source.kind==="metric")){
    const current=await getXmMetrics();
    sources=sources.flatMap(source=>{
      if(source.kind!=="metric")return [source];
      const metric=current.data.find(row=>row.id===source.contentId&&row.status==="ok"&&row.value!==null);
      return metric?[{...source,metric,publishedAt:metric.date,description:metric.description+" Último dato publicado: "+metric.value+" "+metric.unit+" ("+metric.date+")."}]:[];
    });
  }
  return {sources,category:detectTopics(question)[0]||sources[0]?.category};
}
