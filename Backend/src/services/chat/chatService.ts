import type { ChatResult, ChatTurn } from "../../../../shared/discovery";
import { retrieve } from "./retrievalService";
import { generateAnswer, INSUFFICIENT, geminiConfigured } from "./geminiService";
import { DiscoveryError } from "../discovery/algolia.service";
export function validateChat(body:unknown):{question:string;history:ChatTurn[]}{
  if(!body||typeof body!=="object")throw new DiscoveryError(400,"Revisa tu pregunta.");
  const b=body as Record<string,unknown>;
  if(typeof b.question!=="string"||!b.question.trim()||b.question.length>1200)throw new DiscoveryError(400,"Escribe una pregunta de hasta 1.200 caracteres.");
  const history=b.history??[];
  if(!Array.isArray(history)||history.length>4||history.some(t=>!t||!["user","assistant"].includes(t.role)||typeof t.content!=="string"||t.content.length>1200))
    throw new DiscoveryError(400,"La conversación es demasiado larga. Inicia una nueva.");
  return {question:b.question.trim(),history:history.map(t=>({role:t.role,content:t.content}))};
}
export async function chat(uid:string,question:string,history:ChatTurn[],deps={retrieve,generateAnswer}):Promise<ChatResult>{
  if(!geminiConfigured()&&deps.generateAnswer===generateAnswer)throw new DiscoveryError(503,"El asistente todavía no está configurado. Puedes consultar las fuentes en la plataforma.");
  const {sources,category}=await deps.retrieve(uid,question,history);
  if(!sources.length)return {answer:INSUFFICIENT,sources:[],category};
  return {answer:await deps.generateAnswer(question,history,sources),sources,category};
}
