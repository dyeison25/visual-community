import type { EnergyContent } from "../../../../shared/discovery";
import { algoliaConfig,validHit } from "./algolia.service";
import { withIndexAliases } from "./indexSchema";
/** Reemplazo por índice temporal: solo publica un catálogo completo y previamente validado. */
export async function publishIndex(contents:EnergyContent[],connection=algoliaConfig(true)){
  if(!contents.length||contents.some(content=>!validHit(content)))throw Error("El catálogo contiene registros inválidos.");
  const {client,indexName}=connection;
  // replaceAllObjects conserva settings, rules y synonyms del índice existente.
  // No volver a ejecutar setSettings: los ajustes los administra el dashboard.
  await client.replaceAllObjects({indexName,objects:contents.map(withIndexAliases),batchSize:500,scopes:["settings","synonyms","rules"]});
  return {indexName,count:contents.length};
}
