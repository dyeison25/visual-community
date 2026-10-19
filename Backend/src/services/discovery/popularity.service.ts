import { getFirestore } from "firebase-admin/firestore";
import type { EnergyContent } from "../../../../shared/discovery";
const views=new Set(["VIEW_ARTICLE","VIEW_REGULATION","VIEW_METRIC","VIEW_ENERGY_COMMUNITY"]);
const eligible=new Set([...views,"CLICK_EXTERNAL_SOURCE","SEARCH_RESULT_CLICK","RECOMMENDATION_CLICK","CLICK_ENERGY_COMMUNITY_MARKER","CHAT_SOURCE_CLICK"]);
export function addPopularity(contents:EnergyContent[],events:{eventType?:string;contentId?:string;source?:string}[]):EnergyContent[]{
  const counts=new Map<string,{views:number;interactions:number}>();
  for(const event of events){
    if(!eligible.has(event.eventType||"")||!event.contentId||!event.source)continue;
    const key=event.source+":"+event.contentId;
    const count=counts.get(key)||{views:0,interactions:0};count.interactions++;
    if(views.has(event.eventType!))count.views++;counts.set(key,count);
  }
  return contents.map(content=>({...content,...(counts.get(content.source+":"+content.contentId)||{views:0,interactions:0})}));
}
/** Muestra acotada solo al indexar: 100 participantes y hasta 100 eventos por participante.
 * Excluye administradores. Algolia recibe contadores, nunca uid ni eventos individuales.
 */
export async function contentPopularity(contents:EnergyContent[]){
  const profiles=await getFirestore().collection("profiles").where("role","==","user").limit(101).get();
  const events: {eventType?:string;contentId?:string;source?:string}[]=[];
  const selected=profiles.docs.slice(0,100);
  for(let i=0;i<selected.length;i+=4){
    const pages=await Promise.all(selected.slice(i,i+4).map(profile=>profile.ref.collection("interactions").orderBy("timestamp","desc").limit(100).get()));
    events.push(...pages.flatMap(page=>page.docs.map(doc=>doc.data())));
  }
  return {contents:addPopularity(contents,events),sample:{profiles:selected.length,events:events.length,maxEventsPerProfile:100,profilesTruncated:profiles.size>100}};
}
