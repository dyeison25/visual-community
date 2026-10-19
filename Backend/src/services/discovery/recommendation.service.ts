import type { EnergyContent, InterestProfile, Recommendation, RecommendationsData } from "../../../../shared/discovery";
import { getInterestProfile } from "./interest.service";
import { searchIndex } from "./algolia.service";
import { localCatalog } from "./catalog.service";
import { contentScore } from "./scoring";
/** Puntaje explicable: intereses, geografía consultada, actualidad y contadores reales. */
export function rankContents(contents:EnergyContent[],profile:InterestProfile,now=Date.now()):Recommendation[]{
  return contents.map(content=>({content,...contentScore(content,profile,now)}))
    .sort((a,b)=>b.score-a.score||a.content.objectID.localeCompare(b.content.objectID))
    .map(({content,reason})=>({content,reason}));
}
export async function recommendations(uid:string):Promise<RecommendationsData>{
  const profile=await getInterestProfile(uid);
  try {
    const result=await searchIndex("",profile,{limit:30});
    if(result.hits.length)return {items:rankContents(result.hits,profile).slice(0,6),provider:"algolia"};
  }catch{/* El catálogo real mantiene disponible el dashboard si falla Algolia. */}
  const local=await localCatalog();
  const ranked=rankContents(local.contents,profile); const perKind=new Map<string,number>();
  return {items:ranked.filter(item=>{const count=perKind.get(item.content.kind)||0;perKind.set(item.content.kind,count+1);return count<2;}).slice(0,6),
    provider:"local",message:"Selección del catálogo disponible en la plataforma. La búsqueda ampliada de Algolia no está disponible temporalmente."};
}
