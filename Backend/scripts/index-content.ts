import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildCatalog } from "../src/services/discovery/catalog.service";
import { algoliaConfig } from "../src/services/discovery/algolia.service";
import { publishIndex } from "../src/services/discovery/indexing.service";
import { contentPopularity } from "../src/services/discovery/popularity.service";
import { getFirebaseAuth } from "../src/config/firebase.config";
const dry=process.argv.includes("--dry-run");
console.log(dry ? "Preparando vista previa sin escrituras." : "Preparando indexación en el índice configurado.");
try {
  const config=dry?null:algoliaConfig(true);
  const {contents,warnings}=await buildCatalog(true);
  if(warnings.length)console.error(warnings.join("; "));
  if(warnings.length)throw Error("Fuentes incompletas: "+warnings.join("; ")+". No se modifica el índice.");
  getFirebaseAuth();
  const ranked=await contentPopularity(contents);
  console.log("Muestra agregada:",JSON.stringify(ranked.sample));
  if(dry){const directory=resolve(import.meta.dir,"../../artifacts");if(!existsSync(directory))mkdirSync(directory,{recursive:true});writeFileSync(resolve(directory,"content-index-preview.json"),JSON.stringify({count:ranked.contents.length,warnings,popularitySample:ranked.sample,sample:ranked.contents.slice(0,3)},null,2));console.log("Vista previa: "+contents.length+" contenidos públicos; ninguna escritura en Algolia.");}
  else if(config){
    const result=await publishIndex(ranked.contents,config);
    console.log("Índice actualizado: "+result.indexName+"; "+result.count+" contenidos públicos.");
  }
} catch(error) {if(error instanceof Error && "code" in error)console.error("Código de operación:", String(error.code)); console.error("No se completó la indexación. Revisa configuración, cuota y disponibilidad de fuentes. No se publicaron credenciales.");process.exitCode=1;}
