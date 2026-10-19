import type { EnergyContent } from "../../../../shared/discovery";
import type { EnergyArticle } from "../../../../shared/models";
import { getCommunityMap } from "../minenergia/map.service";
import { getCommunities } from "../minenergia/minenergia.service";
import { getMinistryArticles } from "../minenergia/articles";
import { cregService } from "../creg/creg.service";
import { getXmMetrics } from "../xm/xm.service";
import { cached } from "../external/http";
const articleTopics:Record<string,string>={"Comunidades energéticas":"energy_communities","Normativa":"regulation","Energía solar":"renewable_energy"};
function articleContent(row:EnergyArticle,indexedAt:string):EnergyContent {
  const topics=row.topics.map(t=>articleTopics[t]).filter((t):t is string=>Boolean(t));
  return {objectID:"article:"+row.id,contentId:row.id,title:row.title,description:row.description,kind:row.source==="CREG"?"regulation":"article",
    category:row.source==="CREG"?"regulation":topics[0]||"energy_communities",topics,source:row.source,sourceUrl:row.sourceUrl,
    publishedAt:row.date,...(row.date?{publishedTimestamp:Date.parse(row.date)/1000}:{}),indexedAt,keywords:row.topics,article:row};
}
/** Unifica fuentes existentes; solo indexa sus resúmenes y campos públicos, nunca perfiles. */
export async function buildCatalog(full=false):Promise<{contents:EnergyContent[];warnings:string[]}> {
  const indexedAt=new Date().toISOString();
  const [communities,regulations,metrics]=await Promise.all([full?getCommunityMap():getCommunities(),cregService.list(),getXmMetrics()]);
  const rows=Array.isArray(communities.data)?communities.data:communities.data.communities;
  const contents:EnergyContent[]=[...getMinistryArticles().data,...regulations.data].map(row=>articleContent(row,indexedAt));
  for(const row of rows)contents.push({objectID:"community:"+row.id,contentId:row.id,title:row.name,
    description:[row.municipality,row.department,row.status||"Sin estado publicado","Registro de MinEnergía; puede ser una postulación."].join(" · "),
    kind:"community",category:"energy_communities",topics:["energy_communities","energy_projects"],source:row.source,sourceUrl:row.sourceUrl,
    publishedAt:null,indexedAt,keywords:["comunidad",row.municipality,row.department],department:row.department,municipality:row.municipality,community:row});
  for(const row of metrics.data) {
    if(row.status!=="ok"||row.value===null)continue;
    const category=row.id==="Gene"?"generation":row.id==="DemaReal"?"demand":"energy_market";
    contents.push({objectID:"metric:"+row.id,contentId:row.id,title:row.name,description:row.description+" Último dato disponible: "+row.value+" "+row.unit+" ("+row.date+").",
      kind:"metric",category,topics:[category],source:row.source,sourceUrl:row.sourceUrl,publishedAt:row.date,
      ...(row.date?{publishedTimestamp:Date.parse(row.date)/1000}:{}),indexedAt,keywords:[row.name,category],metric:row});
  }
  return {contents,warnings:[...(communities.status==="unavailable"?["MinEnergía no disponible"]:[]),
    ...(metrics.data.some(row=>row.status!=="ok")?["Una o más métricas XM no están disponibles"]:[])]};
}
export const localCatalog=()=>cached("discovery:catalog",()=>buildCatalog(),300000);
