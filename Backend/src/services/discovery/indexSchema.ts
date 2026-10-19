import type { EnergyContent } from "../../../../shared/discovery";
import { TOPIC_OPTIONS } from "../../../../shared/preferences";

/** Los identificadores internos no cambian al traducir atributos en Algolia. */
export const fieldAliases = {
  title:"titulo", description:"descripcion", municipality:"municipio", department:"departamento",
  keywords:"palabrasClave", topics:"temas", category:"categoria", source:"fuente",
  views:"vistas", interactions:"interacciones", publishedTimestamp:"timestampPublicacion",
} as const;
const clean=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
export function canonicalTopic(value:string):string {
  return TOPIC_OPTIONS.find(topic=>topic.id===value || clean(topic.label)===clean(value))?.id || value;
}
/** Conserva el contrato de detalle existente; no fabrica documentos, fechas ni contadores. */
export function normalizeIndexRecord(value:unknown):unknown {
  if(!value || typeof value!=="object" || Array.isArray(value))return value;
  const record={...value} as Record<string,unknown>;
  for(const [internal,alias] of Object.entries(fieldAliases))if(record[alias]!==undefined)record[internal]=record[alias];
  if(typeof record.category==="string")record.category=canonicalTopic(record.category);
  if(Array.isArray(record.topics))record.topics=record.topics.map(t=>typeof t==="string"?canonicalTopic(t):t);
  return record;
}
/** Publica también los nombres del dashboard, conservando payloads y campos anteriores. */
export function withIndexAliases(content:EnergyContent):Record<string,unknown> {
  const record={...content} as unknown as Record<string,unknown>;
  for(const [internal,alias] of Object.entries(fieldAliases))if(record[internal]!==undefined)record[alias]=record[internal];
  return record;
}
export interface IndexFacets {
  topics:string; category:string; department:string; municipality:string;
  values?:Record<string,string[]>;
}
export const legacyFacets:IndexFacets={topics:"topics",category:"category",department:"department",municipality:"municipality"};
export function detectIndexFacets(facets:Record<string,Record<string,number>>={}):IndexFacets {
  const fields={...legacyFacets};
  for(const key of ["topics","category","department","municipality"] as const) {
    const alias=fieldAliases[key];
    if(Object.hasOwn(facets,alias))fields[key]=alias;
  }
  return {...fields,values:Object.fromEntries(Object.entries(facets).map(([key,value])=>[key,Object.keys(value)]))};
}
export function topicFacetValues(topic:string,field:string,schema:IndexFacets):string[] {
  const values=schema.values?.[field];
  return values ? values.filter(value=>canonicalTopic(value)===topic) : [topic];
}
