import type { EnergyContent, InterestProfile } from "../../../../shared/discovery";
import { topicLabel } from "../../../../shared/preferences";
const count=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)&&value>0?value:0;
export function contentScore(content:EnergyContent,profile:InterestProfile,now=Date.now()) {
  const topic=[...new Set([content.category,...content.topics])].sort((a,b)=>(profile.affinity[b]||0)-(profile.affinity[a]||0))[0]||content.category;
  const topicScore=count(profile.affinity[topic]);
  const department=content.department||content.community?.department;
  const municipality=content.municipality||content.community?.municipality;
  const departmentCount=department?count(profile.geography?.departments[department]):0;
  const municipalityCount=count(profile.geography?.municipalities.find(place=>place.department===department&&place.municipality===municipality)?.count);
  const geography=Math.min(2,Math.log2(1+departmentCount)/2)+Math.min(2,Math.log2(1+municipalityCount)/2);
  const age=content.publishedAt?(now-Date.parse(content.publishedAt))/86400000:Infinity;
  const freshness=age>=0?Math.max(0,1-age/90):0;
  const popularity=Math.min(1,Math.log2(1+count(content.interactions)+count(content.views))/10);
  const reasons:string[]=[];
  if(profile.declaredPreferences.includes(topic))reasons.push("Por tu interés en "+topicLabel(topic));
  else if(profile.topicInteractionCounts[topic])reasons.push("Por tus consultas sobre "+topicLabel(topic));
  if(municipalityCount)reasons.push("Has consultado comunidades de "+municipality+" ("+department+")");
  else if(departmentCount)reasons.push("Has consultado comunidades de "+department);
  if(!reasons.length && freshness>0)reasons.push("Publicación reciente de una fuente oficial");
  if(!reasons.length && popularity>0)reasons.push("Consultado por usuarios de la plataforma");
  return {score:topicScore+geography+freshness+popularity,reason:reasons.join(". ")||"Información oficial para explorar"};
}

/** No altera grupos con distinta relevancia ni cruza los límites de página de Algolia. */
export function personalizeTextTies<T extends EnergyContent & {_rankingInfo?:Record<string,unknown>}>(hits:T[],profile:InterestProfile):T[] {
  const key=(hit:T)=>{
    const r=hit._rankingInfo;
    const fields=["nbTypos","words","proximityDistance","firstMatchedWord","nbExactWords"];
    if(!r || fields.some(field=>typeof r[field]!=="number"||!Number.isFinite(r[field])))return null;
    return JSON.stringify([...fields.map(field=>r[field]),r.geoDistance??0,r.promoted??false]);
  };
  const result:T[]=[];
  for(let start=0;start<hits.length;){
    const signature=key(hits[start]!);let end=start+1;
    while(signature!==null&&end<hits.length&&key(hits[end]!)===signature)end++;
    result.push(...hits.slice(start,end).sort((a,b)=>contentScore(b,profile).score-contentScore(a,profile).score));
    start=end;
  }
  return result;
}
