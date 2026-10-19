import type { ChatTurn,EnergyContent,InterestProfile } from "../../../../shared/discovery";
import { inferTopics } from "../../../../shared/preferences";
import { rankContents } from "../discovery/recommendation.service";
export function normalized(text:string){return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();}
const contains=(text:string,phrase:string)=>(" "+normalized(text)+" ").includes(" "+normalized(phrase)+" ");
/** Selección determinista de contexto, sin generar respuestas ni inventar ubicaciones. */
export function selectLocalContext(contents:EnergyContent[],question:string,history:ChatTurn[],profile:InterestProfile):EnergyContent[]{
  const current=normalized(question),previous=[...history].reverse().find(turn=>turn.role==="user")?.content||"";
  const followup=/^(y |cuales |esas |esos |ellos |ellas |mas )/.test(current);
  const combined=followup?previous+" "+question:question;
  const topics=inferTopics(combined);
  if(/recomiend|mis preferencias|mis intereses|informacion nueva|novedades/.test(current)){
    return rankContents(contents.filter(c=>c.kind!=="community"),profile).slice(0,5).map(item=>({...item.content,description:item.content.description+" "+item.reason+"."}));
  }
  const communities=contents.filter(c=>c.kind==="community");
  const departments=[...new Set(communities.map(c=>c.department).filter((s):s is string=>!!s&&s!=="Sin departamento"))];
  const municipalities=[...new Set(communities.map(c=>c.municipality).filter((s):s is string=>!!s&&s!=="Sin municipio"))];
  const departmentsNow=departments.filter(place=>contains(question,place));
  const departmentsPrevious=followup?departments.filter(place=>contains(previous,place)):[];
  const activeDepartments=departmentsNow.length?departmentsNow:departmentsPrevious;
  const cities=municipalities.filter(place=>contains(question,place));
  const listing=(topics.includes("energy_communities")||followup)&&(/hay|existen|cuales|donde|ubicad|lista|cerca/.test(current)||activeDepartments.length||cities.length);
  let candidates:EnergyContent[];
  if(topics.includes("regulation"))candidates=contents.filter(c=>c.kind==="regulation");
  else if(topics.some(t=>["demand","generation","energy_market"].includes(t)))candidates=contents.filter(c=>c.kind==="metric"&&topics.includes(c.category));
  else if(listing){
    if(/\ben\s+/.test(current)&&!activeDepartments.length&&!cities.length)return [];
    candidates=communities.filter(c=>(!activeDepartments.length||activeDepartments.includes(c.department!))&&(!cities.length||cities.includes(c.municipality!)));
  }else if(topics.length)candidates=contents.filter(c=>c.kind!=="community"&&c.kind!=="metric"&&c.topics.some(t=>topics.includes(t)));
  else{
    const words=current.split(" ").filter(w=>w.length>3&&!["tiene","sobre","informacion","plataforma","disponible","quiero","saber"].includes(w));
    candidates=contents.filter(c=>words.length>0&&words.every(word=>normalized(c.title+" "+c.description).includes(word)));
  }
  return rankContents(candidates,profile).slice(0,5).map(item=>item.content);
}
