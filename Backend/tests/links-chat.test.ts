import { expect,test } from "bun:test";
import { MINISTRY_BACKUPS,MINISTRY_COMMUNITIES_PAGE,publicMinistryUrl } from "../../shared/officialSources";
import { resolveMinistryUrl,validatePublicPage } from "../src/services/minenergia/public-links.service";
import { selectLocalContext } from "../src/services/chat/localRetrieval";
import { normalizeHitLinks } from "../src/services/discovery/algolia.service";
import { buildInterestProfile } from "../src/services/discovery/interest.service";
import type { EnergyContent } from "../../shared/discovery";
const html=(body="<h1>Información institucional</h1>")=>new Response(body,{headers:{"content-type":"text/html"}});
const base=(id:string,kind:EnergyContent["kind"],category:string):EnergyContent=>({objectID:id,contentId:id,title:id,description:"Fixture explícito para pruebas",kind,category,topics:[category],source:"MinEnergía",sourceUrl:MINISTRY_COMMUNITIES_PAGE,publishedAt:null,indexedAt:"2026-09-21",keywords:[]});
const rows=[{...base("Antioquia", "community","energy_communities"),department:"ANTIOQUIA",municipality:"MEDELLÍN"},{...base("Guajira","community","energy_communities"),department:"LA GUAJIRA",municipality:"URIBIA"},base("Definición","article","energy_communities"),base("Norma","regulation","regulation"),base("Demanda","metric","demand"),base("Solar","article","renewable_energy")];
const profile=buildInterestProfile("fixture",["energy_communities"],[]);
test("enlace individual verificado tiene prioridad; no se fabrica a partir del nombre",async()=>{
 const individual="https://www.minenergia.gov.co/es/ficha-fixture/";
 expect(await resolveMinistryUrl(individual,async()=>html())).toBe(individual);
});
test("enlaces técnicos, antiguos y no oficiales nunca se solicitan",async()=>{
 for(const url of ["https://www.minenergia.gov.co/es/comunidades-energeticas/","https://www.minenergia.gov.co/MapServer/0","https://www.minenergia.gov.co/a.json","https://evil.invalid","http://127.0.0.1","https://www.minenergia.gov.co/rest/services"]){
  expect(publicMinistryUrl(url)).toBe(false);let calls:string[]=[];
  expect(await resolveMinistryUrl(url,async target=>{calls.push(String(target));return html();})).toBe(MINISTRY_COMMUNITIES_PAGE);
  expect(calls).toEqual([MINISTRY_COMMUNITIES_PAGE]);
 }
});
test("404 y contenido no encontrado con HTTP 200 pasan al respaldo",async()=>{
 for(const response of [new Response("",{status:404}),html("Lo sentimos, no encontramos el contenido que buscas."),html("<title>URL Bloqueada</title>")]){
  let count=0;expect(await resolveMinistryUrl(undefined,async()=>++count===1?response:html())).toBe(MINISTRY_BACKUPS[1]);
 }
});
test("rechaza JSON y redirecciones a dominios ajenos; todos caídos no ofrece enlace",async()=>{
 expect(await validatePublicPage(MINISTRY_COMMUNITIES_PAGE,async()=>Response.json({}))).toBe(false);
 expect(await validatePublicPage(MINISTRY_COMMUNITIES_PAGE,async()=>new Response("",{status:302,headers:{location:"https://evil.invalid"}}))).toBe(false);
 expect(await resolveMinistryUrl(undefined,async()=>new Response("",{status:503}))).toBeNull();
});
test("los enlaces retirados de un índice antiguo se normalizan",()=>{
 const hit=normalizeHitLinks({...rows[0]!,sourceUrl:"https://www.minenergia.gov.co/es/comunidades-energeticas/"});
 expect(hit.sourceUrl).toBe(MINISTRY_COMMUNITIES_PAGE);
});
test("recuperación: definición, Guajira, normativa y demanda",()=>{
 expect(selectLocalContext(rows,"¿Qué es una comunidad energética?",[],profile).some(c=>c.objectID==="Definición")).toBe(true);
 expect(selectLocalContext(rows,"¿Qué comunidades energéticas hay en La Guajira?",[],profile).map(c=>c.objectID)).toEqual(["Guajira"]);
 expect(selectLocalContext(rows,"¿Qué normativa relacionada con comunidades energéticas está disponible?",[],profile).map(c=>c.objectID)).toEqual(["Norma"]);
 expect(selectLocalContext(rows,"¿Qué información tiene la plataforma sobre demanda energética?",[],profile).map(c=>c.objectID)).toEqual(["Demanda"]);
});
test("seguimiento conserva Antioquia y filtra Medellín sin inventar otras ubicaciones",()=>{
 expect(selectLocalContext(rows,"¿Y cuáles están en Medellín?",[{role:"user",content:"¿Qué comunidades hay en Antioquia?"}],profile).map(c=>c.objectID)).toEqual(["Antioquia"]);
 expect(selectLocalContext(rows,"¿Qué comunidades hay en Marte?",[],profile)).toEqual([]);
 expect(selectLocalContext(rows,"Receta de torta de chocolate",[],profile)).toEqual([]);
});
test("recomendación prioriza preferencias sin presentar datos de seguimiento",()=>{
 const solar=buildInterestProfile("fixture",["renewable_energy"],[]);
 expect(selectLocalContext(rows,"¿Qué temas me recomiendas según mis preferencias?",[],solar)[0]?.objectID).toBe("Solar");
});
