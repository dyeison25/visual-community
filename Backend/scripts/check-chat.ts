import { DiscoveryError } from "../src/services/discovery/algolia.service";
import { geminiConfigured } from "../src/services/chat/geminiService";
import { buildCatalog } from "../src/services/discovery/catalog.service";
import { buildInterestProfile } from "../src/services/discovery/interest.service";
import { selectLocalContext } from "../src/services/chat/localRetrieval";
import { generateAnswer } from "../src/services/chat/geminiService";
const live=process.argv.includes("--live");
const questions=["¿Qué es una comunidad energética?","¿Qué comunidades energéticas hay en La Guajira?","¿Qué normativa relacionada con comunidades energéticas está disponible?","¿Qué información tiene la plataforma sobre demanda energética?"];
console.log(JSON.stringify({provider:"gemini",geminiConfigured:geminiConfigured(),model:process.env.GEMINI_MODEL||null,live}));
if(live&&!geminiConfigured()){console.error("Completa GEMINI_API_KEY y GEMINI_MODEL en Backend/.env. No se realizó ninguna llamada a Gemini.");process.exit(1);}
try {
 const catalog=await buildCatalog(true),profile=buildInterestProfile("verification",["energy_communities","renewable_energy"],[]);
 for(const question of questions){
  const sources=selectLocalContext(catalog.contents,question,[],profile);
  if(!sources.length)throw Error("Sin contexto para una consulta de verificación.");
  const answer=live?await generateAnswer(question,[],sources):undefined;
  console.log(JSON.stringify({question,sources:sources.map(s=>({title:s.title,source:s.source,url:s.sourceUrl})),...(answer?{answer}:{})}));
 }
 const first="¿Qué comunidades hay en Antioquia?",followup="¿Y cuáles están en Medellín?";
 const sources=selectLocalContext(catalog.contents,followup,[{role:"user",content:first}],profile);
 console.log(JSON.stringify({followup,sources:sources.map(s=>({municipality:s.municipality,department:s.department}))}));
} catch(error) {console.error(error instanceof DiscoveryError ? error.publicMessage : "La comprobación no pudo completarse. Revisa disponibilidad de fuentes, configuración y cuota.");process.exitCode=1;}
