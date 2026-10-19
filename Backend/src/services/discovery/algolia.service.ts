import { algoliasearch } from "algoliasearch";
import { cached } from "../external/http";
import { detectIndexFacets, legacyFacets, normalizeIndexRecord, topicFacetValues, type IndexFacets } from "./indexSchema";
import { personalizeTextTies } from "./scoring";
import type { EnergyContent, InterestProfile, SearchData } from "../../../../shared/discovery";
import { officialContentUrl } from "../../../../shared/discovery";
import { normalizeMinistryUrl } from "../../../../shared/officialSources";
export function normalizeHitLinks(hit:EnergyContent):EnergyContent {
  if(hit.source!=="MinEnergía")return hit;
  const sourceUrl=normalizeMinistryUrl(hit.sourceUrl);
  return {...hit,sourceUrl,...(hit.article?{article:{...hit.article,sourceUrl}}:{}),...(hit.community?{community:{...hit.community,sourceUrl}}:{})};
}
export class DiscoveryError extends Error {
  constructor(public status:number,public publicMessage:string){super(publicMessage);}
}
const attributesToRetrieve=["objectID","contentId","title","description","kind","category","topics","source","sourceUrl","publishedAt","indexedAt","keywords","department","municipality","article","community","metric","publishedTimestamp","views","interactions"];
export function algoliaConfig(admin=false){
  const appId=process.env.ALGOLIA_APP_ID, key=admin?process.env.ALGOLIA_ADMIN_API_KEY:process.env.ALGOLIA_SEARCH_API_KEY,indexName=process.env.ALGOLIA_INDEX_NAME;
  if(!appId||!key||!indexName)throw new DiscoveryError(503,"La búsqueda todavía no está configurada. Puedes consultar las secciones de la plataforma.");
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(indexName))throw new DiscoveryError(503,"La búsqueda no está disponible temporalmente.");
  return {client:algoliasearch(appId,key,{timeouts:{connect:2000,read:6000,write:20000}}),indexName};
}
// Los filtros opcionales promocionan coincidencias; nunca excluyen otros intereses.
export function facetFilter(field:string,value:string):string {
  return field+":"+JSON.stringify(value);
}
export function optionalFilters(profile:InterestProfile,schema:IndexFacets=legacyFacets): (string|string[])[] {
  const filters:(string|string[])[]=[];
  for(const [topic,score] of Object.entries(profile.affinity)){
    if(!Number.isFinite(score)||score<=0)continue;
    // OR: no duplica el puntaje si el mismo tema aparece en categoría y temas.
    const group=[schema.topics,schema.category].flatMap(field=>topicFacetValues(topic,field,schema)
      .map(value=>facetFilter(field,value)+"<score="+Math.min(180,Math.max(1,Math.round(score*10)))+">"));
    if(group.length)filters.push(group);
  }
  for(const [department,count] of Object.entries(profile.geography?.departments||{}).sort((a,b)=>b[1]-a[1]).slice(0,3)){
    if(count>0)filters.push(facetFilter(schema.department,department)+"<score="+Math.min(20,Math.round(5*Math.log2(1+count)))+">");
  }
  // Los municipios pueden tener homónimos: el scoring local exige municipio Y departamento.
  return filters;
}
export async function indexFacets(connection:ReturnType<typeof algoliaConfig>):Promise<IndexFacets>{
  return cached("algolia:facets:"+process.env.ALGOLIA_APP_ID+":"+connection.indexName,async()=>{
    const result=await connection.client.searchSingleIndex({indexName:connection.indexName,searchParams:{
      query:"",hitsPerPage:0,facets:["topics","category","department","municipality","temas","categoria","departamento","municipio"],
      maxValuesPerFacet:100,analytics:false,clickAnalytics:false,
    }});
    return detectIndexFacets(result.facets);
  },60000);
}
export function validHit(value:unknown): value is EnergyContent {
  if(!value||typeof value!=="object")return false;
  const v=value as EnergyContent;
  if (v.kind==="community" && (!v.community || v.community.sourceUrl!==v.sourceUrl || typeof v.community.name!=="string"
      || typeof v.community.department!=="string" || typeof v.community.municipality!=="string"
      || [v.community.latitude,v.community.longitude].some(n=>n!==null&&(typeof n!=="number"||!Number.isFinite(n)))))return false;
  if (["article","regulation"].includes(v.kind) && (!v.article || v.article.sourceUrl!==v.sourceUrl || typeof v.article.title!=="string" || typeof v.article.description!=="string" || !["Guía","Resolución","Decreto","Información"].includes(v.article.type)))return false;
  return typeof v.objectID==="string"&&typeof v.contentId==="string"&&typeof v.title==="string"&&typeof v.description==="string"
    && ["article","regulation","community","metric"].includes(v.kind)&&["MinEnergía","CREG","XM"].includes(v.source)
    && Array.isArray(v.topics)&&v.topics.every(t=>typeof t==="string")&&officialContentUrl(v.sourceUrl)
    && (v.publishedAt===null||typeof v.publishedAt==="string"&&Number.isFinite(Date.parse(v.publishedAt)));
}
export async function searchIndex(query:string,profile:InterestProfile,options:{page?:number;category?:string;limit?:number}={},connection?:ReturnType<typeof algoliaConfig>):Promise<SearchData>{
  const config=connection||algoliaConfig();
  const {client,indexName}=config;
  try {
    const schema=await indexFacets(config);
    const textual=Boolean(query.trim());
    const selected=options.category?[schema.topics,schema.category].flatMap(field=>topicFacetValues(options.category!,field,schema).map(value=>facetFilter(field,value))):[];
    const response=await client.searchSingleIndex<EnergyContent>({indexName,searchParams:{
      query:query.slice(0,180),page:options.page||0,hitsPerPage:Math.min(30,options.limit||12),
      optionalFilters:textual?[]:optionalFilters(profile,schema),sumOrFiltersScores:false,
      ...(options.category?{filters:selected.length?"("+selected.join(" OR ")+")":facetFilter(schema.topics,options.category)}:{}),
      getRankingInfo:textual,queryLanguages:["es"],enablePersonalization:false,enableReRanking:false,
      attributesToRetrieve:[...attributesToRetrieve,"titulo","descripcion","municipio","departamento","palabrasClave","temas","categoria","fuente","vistas","interacciones","timestampPublicacion"],
      attributesToHighlight:[],attributesToSnippet:[],analytics:false,clickAnalytics:false,
    }});
    if(!Array.isArray(response.hits))throw Error("Invalid result");
    const hits=response.hits.map(normalizeIndexRecord).filter(validHit).map(normalizeHitLinks);
    const ordered=textual?personalizeTextTies(hits,profile):hits;
    // Los puntajes internos se utilizan en backend; no se muestran en el perfil del usuario.
    return {hits:ordered.map(hit=>{const {_rankingInfo,...content}=hit as EnergyContent & {_rankingInfo?:unknown};return content;}),total:response.nbHits||0,page:response.page||0,pages:response.nbPages||0,provider:"algolia"};
  } catch {throw new DiscoveryError(503,"La búsqueda no está disponible temporalmente. Intenta nuevamente.");}
}
