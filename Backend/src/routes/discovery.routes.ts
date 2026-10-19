import { Router, type Response } from "express";
import { TOPIC_OPTIONS } from "../../../shared/preferences";
import { DiscoveryError, searchIndex } from "../services/discovery/algolia.service";
import { getInterestProfile } from "../services/discovery/interest.service";
import { recommendations } from "../services/discovery/recommendation.service";
export function discoveryError(error:unknown,res:Response){
  if(error instanceof DiscoveryError)res.status(error.status).json({message:error.publicMessage});
  else res.status(503).json({message:"La información no está disponible temporalmente. Intenta nuevamente."});
}
export const discoveryRoutes=Router();
discoveryRoutes.use((_req,res,next)=>{res.setHeader("Cache-Control","private, no-store");next();});
discoveryRoutes.get("/search",async(req,res)=>{
  const query=req.query.q??"",category=req.query.category,page=Number(req.query.page??0);
  if(typeof query!=="string"||query.length>180||!Number.isSafeInteger(page)||page<0||page>80
    ||category!==undefined&&(typeof category!=="string"||!TOPIC_OPTIONS.some(t=>t.id===category))){
    res.status(400).json({message:"Revisa los filtros de búsqueda."});return;
  }
  try {res.json(await searchIndex(query,await getInterestProfile(res.locals.user.uid),{page,category:category as string|undefined}));}
  catch(error){discoveryError(error,res);}
});
discoveryRoutes.get("/recommendations",async(_req,res)=>{
  try{res.json(await recommendations(res.locals.user.uid));}catch(error){discoveryError(error,res);}
});
