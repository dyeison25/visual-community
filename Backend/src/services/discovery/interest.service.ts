import { getFirestore } from "firebase-admin/firestore";
import type { EnergyContent, InterestProfile } from "../../../../shared/discovery";
import type { UserProfile } from "../../../../shared/models";
import { profileTopics, TOPIC_OPTIONS } from "../../../../shared/preferences";
import { cached } from "../external/http";
import { eventObjectID, historyContents } from "./historyContent.service";
export type InterestEvent={eventType?:string;contentId?:string;source?:string;timestamp?:string|null;metadata?:{category?:string}};
export { inferTopics as detectTopics } from "../../../../shared/preferences";
const eligible=new Set(["VIEW_ARTICLE","VIEW_REGULATION","VIEW_METRIC","VIEW_ENERGY_COMMUNITY","CLICK_EXTERNAL_SOURCE","SEARCH","SEARCH_RESULT_CLICK","RECOMMENDATION_CLICK","CLICK_ENERGY_COMMUNITY_MARKER"]);
export function eventTopics(event:InterestEvent):string[] {
  if(!eligible.has(event.eventType||""))return [];
  if(TOPIC_OPTIONS.some(t=>t.id===event.metadata?.category))return [event.metadata!.category!];
  if(event.eventType==="VIEW_REGULATION" || event.contentId?.startsWith("creg-"))return ["regulation"];
  if(event.eventType==="VIEW_ENERGY_COMMUNITY" || /^\d+$/.test(event.contentId||""))return ["energy_communities"];
  if(event.contentId==="Gene")return ["generation"];
  if(event.contentId==="DemaReal")return ["demand"];
  if(event.contentId==="PrecBolsNaci")return ["energy_market"];
  if(event.contentId==="min-manual")return ["energy_communities","renewable_energy"];
  if(event.contentId==="min-comunidades")return ["energy_communities"];
  return [];
}
/** Preferencias + frecuencia acotada + actividad reciente. Solo eventos de los últimos 200 registros. */
export function buildInterestProfile(userId:string,declared:string[],events:InterestEvent[],now=Date.now(),contents:EnergyContent[]=[]):InterestProfile {
  declared=[...new Set(declared.filter(id=>TOPIC_OPTIONS.some(topic=>topic.id===id)))];
  const byID=new Map(contents.map(content=>[content.objectID,content]));
  const departments:Record<string,number>={};
  const municipalities=new Map<string,{department:string;municipality:string;count:number}>();
  const counts:Record<string,number>={}; const recent=new Set<string>();
  for(const event of events){
    if(!eligible.has(event.eventType||""))continue;
    const time=event.timestamp?Date.parse(event.timestamp):NaN;
    if(time>now)continue;
    const content=byID.get(eventObjectID(event)||"");
    // Solo enriquece eventos que coinciden con un contenido real de la misma fuente.
    const verified=content&&content.source===event.source&&content.contentId===event.contentId?content:undefined;
    const topics=[...new Set([...eventTopics(event),...(verified?[verified.category,...verified.topics]:[])])].filter(id=>TOPIC_OPTIONS.some(t=>t.id===id));
    for(const topic of topics){
      counts[topic]=(counts[topic]||0)+1;
      if(time>=now-7*86400000)recent.add(topic);
    }
    const department=verified?.community?.department||verified?.department;
    const municipality=verified?.community?.municipality||verified?.municipality;
    if(department){
      departments[department]=(departments[department]||0)+1;
      if(municipality){
        const key=JSON.stringify([department,municipality]);
        const place=municipalities.get(key)||{department,municipality,count:0};
        place.count++;municipalities.set(key,place);
      }
    }
  }
  const affinity:Record<string,number>={};
  for(const {id} of TOPIC_OPTIONS)affinity[id]=(declared.includes(id)?6:0)+Math.min(10,2*Math.log2(1+(counts[id]||0)))+(recent.has(id)?2:0);
  return {userId,declaredPreferences:declared,topicInteractionCounts:counts,recentTopics:[...recent],affinity,updatedAt:new Date(now).toISOString(),sampleSize:events.length,geography:{departments,municipalities:[...municipalities.values()].sort((a,b)=>b.count-a.count)}};
}
export function getInterestProfile(uid:string):Promise<InterestProfile> {
  return cached("interests:"+uid,async()=>{
    const db=getFirestore(); const ref=db.collection("profiles").doc(uid);
    const [profile,events]=await Promise.all([ref.get(),ref.collection("interactions").orderBy("timestamp","desc").limit(200).get()]);
    if(!profile.exists)throw Error("Missing profile");
    const history:InterestEvent[]=events.docs.map(doc=>{
      const data=doc.data();return {...data,timestamp:data.timestamp?.toDate?.().toISOString()||null};
    });
    const contents=await historyContents(history.filter(event=>eligible.has(event.eventType||"")));
    const result=buildInterestProfile(uid,profileTopics(profile.data() as UserProfile),history,Date.now(),contents);
    await ref.collection("interestProfile").doc("current").set(result);
    return result;
  },60000);
}
