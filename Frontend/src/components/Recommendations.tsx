import { useResource } from "../hooks/useResource";
import { discoveryService } from "../services/discoveryService";
import { ContentResults } from "./ContentResults";
import { Empty,ErrorState,Loading,SectionHeading } from "./UI";
export function Recommendations(){
  const resource=useResource(discoveryService.recommendations);
  return <section><SectionHeading title="Recomendado para ti" eyebrow="TUS INTERESES, NUEVAS CONEXIONES"/>
    {resource.loading?<Loading label="Preparando recomendaciones…"/>:resource.error?<ErrorState message={resource.error} retry={resource.refresh}/>:<>
      {resource.data?.message&&<p className="muted small discovery-note">{resource.data.message}</p>}
      {resource.data?.items.length?<ContentResults items={resource.data.items} origin="recommendation"/>:<Empty>Aún no hay recomendaciones disponibles.</Empty>}
    </>}</section>;
}
