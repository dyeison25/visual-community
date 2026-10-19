import { useCallback,useEffect,useState } from "react";
import { useSearchParams } from "react-router-dom";
import { discoveryService } from "../services/discoveryService";
import { interactionService } from "../services/interactionService";
import { useResource } from "../hooks/useResource";
import { ContentResults } from "../components/ContentResults";
import { PageHeading,Empty,Loading,ErrorState } from "../components/UI";
import { TOPIC_OPTIONS, inferTopics } from "../../../shared/preferences";
export function SearchPage(){
  const [params,setParams]=useSearchParams();const query=params.get("q")||"",category=params.get("category")||"",page=Math.max(0,Number(params.get("page"))||0);
  const [draft,setDraft]=useState(query);
  useEffect(()=>setDraft(query),[query]);
  const resource=useResource(useCallback((signal:AbortSignal)=>discoveryService.search(query,page,category,signal),[query,page,category]));
  useEffect(()=>{if(query)void interactionService.track({eventType:"SEARCH",metadata:{queryLength:Math.min(query.length,1200),...((category||inferTopics(query)[0])?{category:category||inferTopics(query)[0]}:{})}});},[query,category]);
  return <><PageHeading title="Explorar información" description="Busca comunidades, normativa e indicadores de fuentes oficiales."/>
    <form className="global-search-form card" onSubmit={e=>{e.preventDefault();setParams({q:draft,category});}}>
      <label htmlFor="global-query">¿Qué quieres consultar?</label><div className="search-controls"><input id="global-query" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={180} placeholder="Energía solar, comunidades, demanda…"/><button className="button primary" type="submit">Buscar</button></div>
      <label htmlFor="search-topic">Filtrar por tema</label><select id="search-topic" value={category} onChange={e=>setParams({q:query,category:e.target.value})}><option value="">Todos los temas</option>{TOPIC_OPTIONS.map(t=><option value={t.id} key={t.id}>{t.label}</option>)}</select>
    </form>
    {resource.loading?<Loading label="Buscando información…"/>:resource.error?<ErrorState message={resource.error} retry={resource.refresh}/>:resource.data?.hits.length?<>
      <p className="muted small discovery-note">{resource.data.total} resultados · Algolia · Tus intereses ayudan a ordenar, sin ocultar otros temas.</p>
      <ContentResults items={resource.data.hits.map(content=>({content,reason:""}))} origin="search"/>
      <div className="pagination"><button className="button secondary" disabled={!page} onClick={()=>setParams({q:query,category,page:String(page-1)})}>Anterior</button><span>Página {page+1}</span><button className="button secondary" disabled={page+1>=resource.data.pages} onClick={()=>setParams({q:query,category,page:String(page+1)})}>Siguiente</button></div>
    </>:<Empty>No encontramos resultados. Prueba otro término o quita el filtro.</Empty>}
  </>;
}
