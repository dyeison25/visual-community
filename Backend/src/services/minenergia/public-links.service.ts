import { MINISTRY_BACKUPS, publicMinistryUrl } from "../../../../shared/officialSources";
import { cached, type Fetcher } from "../external/http";
/** Verifica solo estado y tipo de página; no extrae ni incorpora contenido del HTML. */
export async function validatePublicPage(url:string,fetcher:Fetcher=fetch):Promise<boolean>{
  if(!publicMinistryUrl(url))return false;
  try {
    let current=url;
    const signal=AbortSignal.timeout(5000);
    for(let redirects=0;redirects<=3;redirects++){
      const response=await fetcher(current,{redirect:"manual",signal,headers:{Accept:"text/html,application/pdf"}});
      if(response.status>=300&&response.status<400){
        const location=response.headers.get("location");if(!location)return false;
        current=new URL(location,current).href;if(!publicMinistryUrl(current))return false;continue;
      }
      if(!response.ok)return false;
      const type=response.headers.get("content-type")||"";
      if(type.includes("application/pdf")){await response.body?.cancel();return true;}
      if(!type.includes("text/html"))return false;
      const html=(await response.text()).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      return !/no encontramos el contenido|contenido que buscas|pagina no encontrada|url bloqueada|pagina web bloqueada|pagina web bloqueda|<title[^>]*>\s*(404|not found)/.test(html);
    }
    return false;
  }catch{return false;}
}
/** URL individual oficial válida → página temática → sección de energía → portal.
 * El candidato solo se admite si pertenece al Ministerio; las redirecciones también se validan.
 */
export async function resolveMinistryUrl(candidate?:unknown,fetcher?:Fetcher):Promise<string|null>{
  const urls=[...new Set([...(publicMinistryUrl(candidate)?[candidate]:[]),...MINISTRY_BACKUPS])];
  for(const url of urls){
    const valid=await (fetcher?validatePublicPage(url,fetcher):cached("min:public-link:"+url,()=>validatePublicPage(url),300000));
    if(valid)return url;
  }
  return null;
}
