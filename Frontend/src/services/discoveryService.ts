import { auth } from "../config/firebase";
import type { ChatResult,ChatTurn,RecommendationsData,SearchData } from "../../../shared/discovery";
async function request<T>(path:string,signal?:AbortSignal,body?:unknown):Promise<T>{
  const user=auth?.currentUser;if(!user)throw Error("Inicia sesión para continuar.");
  const response=await fetch((import.meta.env.VITE_API_BASE_URL||"/api")+path,{
    method:body?"POST":"GET",headers:{Authorization:"Bearer "+await user.getIdToken(),"Content-Type":"application/json"},
    signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(body?60000:28000)]),...(body?{body:JSON.stringify(body)}:{})
  });
  if(!response.ok){
    const data=await response.json().catch(()=>null);
    throw Error(typeof data?.message==="string"?data.message:"No pudimos completar la consulta. Intenta nuevamente.");
  }
  return response.json() as Promise<T>;
}
export const discoveryService={
  recommendations:(signal?:AbortSignal)=>request<RecommendationsData>("/discovery/recommendations",signal),
  search:(query:string,page=0,category="",signal?:AbortSignal)=>request<SearchData>("/discovery/search?"+new URLSearchParams({q:query,page:String(page),...(category?{category}:{})}),signal),
  chat:(question:string,history:ChatTurn[],signal?:AbortSignal)=>request<ChatResult>("/chat",signal,{question,history}),
};
