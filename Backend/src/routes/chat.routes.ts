import { Router } from "express";
import { chat, validateChat } from "../services/chat/chatService";
import { discoveryError } from "./discovery.routes";
export const chatRoutes=Router();
const usage=new Map<string,{count:number;until:number;inFlight:boolean}>();
/** Máximo 6 consultas/minuto por uid y una en curso. No hay llamada automática ni reintentos del proveedor. */
chatRoutes.post("/",async(req,res)=>{
  res.setHeader("Cache-Control","private, no-store");
  const uid=String(res.locals.user.uid),now=Date.now();
  for(const [key,value] of usage)if(value.until<now&&!value.inFlight)usage.delete(key);
  const entry=usage.get(uid)||{count:0,until:now+60000,inFlight:false};
  if(entry.inFlight||entry.count>=6||usage.size>=10000){res.setHeader("Retry-After","60");res.status(429).json({message:"Espera un minuto antes de enviar otra pregunta."});return;}
  try{
    const {question,history}=validateChat(req.body);
    entry.count++;entry.inFlight=true;usage.set(uid,entry);
    res.json(await chat(uid,question,history));
  }catch(error){discoveryError(error,res);}
  finally{entry.inFlight=false;}
});
