import { useState } from "react";
import { Scale, Search } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { energyService } from "../services/energyService";
import { ArticleCard, Empty, ErrorState, Loading, Notice, PageHeading, SourceLink } from "../components/UI";
import { ArticleDialog } from "../components/ArticleDialog";
import type { EnergyArticle } from "../../../shared/models";
export function RegulationsPage() {
  const resource = useResource(energyService.regulations); const [search, setSearch] = useState(""); const [article, setArticle] = useState<EnergyArticle | null>(null);
  const filtered = resource.data?.data.filter(item => (item.title + " " + item.description).toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))) || [];
  return <><PageHeading title="Un marco para transformar." description="Normativa y documentos para comprender las comunidades energéticas y la generación distribuida."/><div className="regulation-banner"><Scale size={32}/><div><h2>Consulta siempre el documento oficial.</h2><p>Explora las resoluciones en el Gestor Normativo Alejandría de la CREG.</p></div><SourceLink source="CREG" contentId="creg-gestor" url="https://gestornormativo.creg.gov.co/gestor/">Ir a Alejandría</SourceLink></div>
    {resource.loading ? <Loading/> : resource.error ? <ErrorState message={resource.error} retry={resource.refresh}/> : <><Notice>{resource.data?.message}</Notice><div className="search-bar"><Search size={19}/><input aria-label="Filtrar normativa" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por número, año o tema" maxLength={100}/><span className="small muted">{filtered.length} documentos</span></div>{!filtered.length ? <Empty>No hay documentos que coincidan con tu búsqueda.</Empty> : <div className="regulations-list">{filtered.map(item => <ArticleCard key={item.id} article={item} onOpen={setArticle}/>)}</div>}</>}
    <section className="card ministry-regulation"><span className="source-tag">MINISTERIO DE MINAS Y ENERGÍA</span><h2>Política pública de comunidades energéticas</h2><p>El Manual de gestión de 2025 explica el marco institucional y los procedimientos de la estrategia, con referencia al Decreto 2236 de 2023.</p><SourceLink source="MinEnergía" contentId="min-normativa" url="https://www.minenergia.gov.co/documents/14860/Manual-Gestion-Comunidades-Energeticas-2025.pdf">Consultar normativa del Ministerio</SourceLink></section>
    <ArticleDialog article={article} close={() => setArticle(null)}/></>;
}
