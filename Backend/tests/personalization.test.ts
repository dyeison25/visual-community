import { expect,test } from "bun:test";
import type { EnergyContent } from "../../shared/discovery";
import { buildInterestProfile } from "../src/services/discovery/interest.service";
import { contentScore,personalizeTextTies } from "../src/services/discovery/scoring";
import { detectIndexFacets,normalizeIndexRecord,withIndexAliases } from "../src/services/discovery/indexSchema";
import { facetFilter,optionalFilters,searchIndex,validHit } from "../src/services/discovery/algolia.service";
import { eventObjectID } from "../src/services/discovery/historyContent.service";
const url="https://www.minenergia.gov.co/es/";
function content(id:string,category="regulation"):EnergyContent {
 return {objectID:"article:"+id,contentId:id,title:id,description:"Contenido oficial",kind:"article",category,topics:[category],source:"MinEnergía",sourceUrl:url,publishedAt:null,indexedAt:"2026-09-22",keywords:[],
 article:{id,title:id,description:"Contenido oficial",source:"MinEnergía",sourceUrl:url,date:null,type:"Información",topics:[]}};
}
const ranking={nbTypos:0,words:2,proximityDistance:1,firstMatchedWord:0,nbExactWords:2};
test("las preferencias no adelantan coincidencias textuales inferiores",()=>{
 const p=buildInterestProfile("u",["renewable_energy"],[]);
 const exact={...content("exact"),_rankingInfo:ranking};
 const weak={...content("weak","renewable_energy"),_rankingInfo:{...ranking,nbTypos:1}};
 expect(personalizeTextTies([exact,weak],p).map(c=>c.contentId)).toEqual(["exact","weak"]);
});
test("desempata por intereses solo con igual relevancia y conserva hits sin ranking",()=>{
 const p=buildInterestProfile("u",["renewable_energy"],[]);
 const rows=[{...content("a"),_rankingInfo:ranking},{...content("b","renewable_energy"),_rankingInfo:ranking}];
 expect(personalizeTextTies(rows,p)[0]?.contentId).toBe("b");
 expect(personalizeTextTies(rows.map(({_rankingInfo,...c})=>c),p)[0]?.contentId).toBe("a");
});
test("temas y categorías en español generan boosts OR sin duplicar señales",()=>{
 const schema=detectIndexFacets({temas:{"Energías renovables":3},categoria:{renewable_energy:3},departamento:{ANTIOQUIA:1}});
 const filters=optionalFilters(buildInterestProfile("u",["renewable_energy"],[]),schema);
 expect(filters).toEqual([['temas:"Energías renovables"<score=60>','categoria:"renewable_energy"<score=60>']]);
 expect(facetFilter("departamento",'A "B"')).toBe('departamento:"A \\"B\\""');
});
test("alias de publicación no inventa fechas, contadores ni información de detalle",()=>{
 const c=content("a");
 const record=withIndexAliases(c);
 expect(record.titulo).toBe(c.title);expect(record.temas).toEqual(c.topics);
 expect(record.timestampPublicacion).toBeUndefined();expect(record.vistas).toBeUndefined();
 expect(validHit(normalizeIndexRecord(record))).toBe(true);
 const {title,description,category,topics,source,keywords,...spanish}=record;
 expect(validHit(normalizeIndexRecord(spanish))).toBe(true);
});
test("geografía procede del contenido consultado y nunca de un nombre supuesto",()=>{
 const now=Date.parse("2026-09-22");
 const place={...content("0","energy_communities"),objectID:"community:0",department:"ANTIOQUIA",municipality:"MEDELLÍN"};
 const events=[{eventType:"VIEW_ENERGY_COMMUNITY",contentId:"0",source:"MinEnergía",timestamp:"2026-09-21"}];
 const p=buildInterestProfile("u",[],events,now,[place]);
 expect(p.geography?.departments).toEqual({ANTIOQUIA:1});
 expect(p.geography?.municipalities[0]?.municipality).toBe("MEDELLÍN");
 expect(contentScore(place,p,now).reason).toContain("MEDELLÍN");
 expect(buildInterestProfile("u",[],events,now).geography?.departments).toEqual({});
 expect(eventObjectID({contentId:"0",source:"Visual Community"})).toBeNull();
});
test("enriquece todos los temas reales de un contenido y excluye accesos de cuenta",()=>{
 const c={...content("min-manual"),topics:["regulation","renewable_energy"]};
 const events=[{eventType:"VIEW_ARTICLE",contentId:c.contentId,source:c.source},{eventType:"LOGIN",contentId:c.contentId,source:c.source}];
 const p=buildInterestProfile("u",[],events,Date.now(),[c]);
 expect(p.topicInteractionCounts.regulation).toBe(1);
 expect(p.topicInteractionCounts.renewable_energy).toBe(1);
 expect(p.sampleSize).toBe(2);
});
test("municipios homónimos de distinto departamento no reciben el mismo puntaje",()=>{
 const p=buildInterestProfile("u",[],[]);
 p.geography={departments:{ANTIOQUIA:4},municipalities:[{department:"ANTIOQUIA",municipality:"SAN PEDRO",count:4}]};
 const a={...content("a"),department:"ANTIOQUIA",municipality:"SAN PEDRO"};
 const b={...content("b"),department:"SUCRE",municipality:"SAN PEDRO"};
 expect(contentScore(a,p).score).toBeGreaterThan(contentScore(b,p).score);
 expect(optionalFilters(p).flat().join(" ")).not.toContain("municipality");
});
test("no fabrica intereses, fechas recientes ni popularidad a partir de datos inválidos",()=>{
 const p=buildInterestProfile("u",["no-existe"],[{eventType:"VIEW_REGULATION",timestamp:"2099-01-01"}]);
 expect(p.declaredPreferences).toEqual([]);expect(p.topicInteractionCounts).toEqual({});
 const c={...content("a"),publishedAt:"2099-01-01",interactions:-20,views:NaN};
 expect(contentScore(c,p).score).toBe(0);
});
test("búsqueda acepta campos españoles y filtros explícitos sin servicios pagos",async()=>{
 let request:any;
 const row=withIndexAliases(content("a"));
 const connection={indexName:"test-spanish-personalization",client:{searchSingleIndex:async(input:any)=>{
  if(input.searchParams.hitsPerPage===0)return {facets:{temas:{regulation:1},categoria:{regulation:1}}};
  request=input;return {hits:[row],nbHits:1,nbPages:1,page:0};
 }}} as any;
 const p=buildInterestProfile("u",["regulation"],[]);
 const result=await searchIndex("",p,{category:"regulation"},connection);
 expect(result.hits[0]?.title).toBe("a");
 expect(request.searchParams.filters).toBe('(temas:"regulation" OR categoria:"regulation")');
 expect(request.searchParams.optionalFilters.flat()).toContain('temas:"regulation"<score=60>');
 expect(request.searchParams.sumOrFiltersScores).toBe(false);
 expect(request.searchParams.enablePersonalization).toBe(false);
 expect(request.searchParams.enableReRanking).toBe(false);
 expect(JSON.stringify(request)).not.toContain('"userToken"');
});
