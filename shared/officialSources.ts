// Página temática oficial verificada por HTTP. No es una ficha individual.
// El portal puede bloquear navegadores automatizados; consultar las limitaciones documentadas.
export const MINISTRY_COMMUNITIES_PAGE="https://www.minenergia.gov.co/es/sala-de-prensa/noticias-index/minenerg%C3%ADa-hace-el-lanzamiento-de-comunidades-energ%C3%A9ticas-una-iniciativa-para-democratizar-la-energ%C3%ADa/";
export const MINISTRY_BACKUPS=[MINISTRY_COMMUNITIES_PAGE,"https://www.minenergia.gov.co/es/misional/energia-electrica-2/","https://www.minenergia.gov.co/es/"];
export function isRetiredMinistryUrl(value:string){
  try {const url=new URL(value);return ["www.minenergia.gov.co","minenergia.gov.co"].includes(url.hostname)&&/^\/es\/comunidades-energeticas(?:\/|$)/i.test(url.pathname);}
  catch{return false;}
}
export function publicMinistryUrl(value:unknown):value is string {
  if(typeof value!=="string"||value.length>2048)return false;
  try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password&&!url.port
    &&["www.minenergia.gov.co","minenergia.gov.co"].includes(url.hostname)
    && !/\/rest(?:\/|$)|FeatureServer|MapServer|\/query(?:\?|$)|\.json(?:$|\?)/i.test(value)
    && !isRetiredMinistryUrl(value);
  }catch{return false;}
}
export function normalizeMinistryUrl(value:string){return isRetiredMinistryUrl(value)?MINISTRY_COMMUNITIES_PAGE:value;}
