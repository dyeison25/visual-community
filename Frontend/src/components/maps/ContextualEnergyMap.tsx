import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, MapPinned } from "lucide-react";
import type { GeographyInput, MapLayerId, MapDisplay } from "../../../../shared/geography";
import { geographyParams, geographyService } from "../../services/geographyService";
import { useResource } from "../../hooks/useResource";
import { ErrorState, Loading } from "../UI";
import { MapFilters } from "./MapFilters";
import { MapLegend } from "./MapLegend";
import { MapRenderer } from "./MapRenderer";
import "./maps.css";
export default function ContextualEnergyMap({ query, category }: { query: string; category: string }) {
  const [params, setParams] = useSearchParams(); const [collapsed, setCollapsed] = useState(false);
  const layer = params.get("mapLayer") || "", department = params.get("mapDepartment") || "", municipality = params.get("mapMunicipality") || "", technology = params.get("mapTechnology") || "", display = params.get("mapDisplay") || "";
  const input: GeographyInput = useMemo(() => ({ q: query, ...(category ? { category } : {}), ...(layer ? { layer: layer as MapLayerId } : {}), ...(department ? { department } : {}), ...(municipality ? { municipality } : {}), ...(technology ? { technology } : {}), ...(display ? { display: display as MapDisplay } : {}) }), [query, category, layer, department, municipality, technology, display]);
  const inputKey = geographyParams(input).toString();
  const resource = useResource(useCallback(async (signal: AbortSignal) => ({ key: inputKey, context: await geographyService.context(input, signal) }), [inputKey]));
  const change = (values: Record<string, string>) => setParams(previous => { const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); } return next; });
  const context = resource.data?.key === inputKey ? resource.data.context : null;
  if (!resource.loading && !resource.error && context?.status === "none") return null;
  return <section className="card contextual-map" aria-label="Mapa contextual de la búsqueda">
    <header className="geo-heading"><div><p className="eyebrow">GEOGRAFÍA OFICIAL · UPME</p><h2><MapPinned size={21}/>{context?.layer?.title || "Mapa contextual"}</h2></div>
      <button className="text-button" aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronDown size={17}/> : <ChevronUp size={17}/ >}{collapsed ? "Mostrar mapa" : "Contraer mapa"}</button></header>
    {!collapsed && <>{resource.loading || !context && !resource.error ? <Loading label="Identificando mapa, territorio y filtros oficiales…"/> : resource.error ? <><ErrorState message={resource.error} retry={resource.refresh}/><button className="text-button" onClick={() => change({ mapLayer: "", mapDepartment: "", mapMunicipality: "", mapTechnology: "", mapDisplay: "" })}>Restablecer filtros del mapa</button></> : context && <>
      <p className="muted small">{context.message}</p>
      {context.choices.length > 1 && <label className="geo-layer-choice">Mapa relacionado<select aria-label="Mapa relacionado" value={context.layer?.id || ""} onChange={e => change({ mapLayer: e.target.value, mapTechnology: "", mapDisplay: "" })}><option value="">Selecciona un mapa</option>{context.choices.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}</select></label>}
      {(context.status === "ready" || context.status === "place_choice") && <MapFilters context={context} department={department} municipality={municipality} change={change}/>}
      {context.placeChoices.length > 0 && <label className="geo-layer-choice">Territorio encontrado<select aria-label="Territorio encontrado" defaultValue="" onChange={e => { const [d, m] = e.target.value.split(":"); change({ mapDepartment: d, mapMunicipality: m || "", mapDisplay: "" }); }}><option value="">Selecciona el territorio correcto</option>{context.placeChoices.map(place => <option key={place.departmentCode + place.municipalityCode} value={place.departmentCode + ":" + (place.municipalityCode || "")}>{place.municipality ? place.municipality + " · " : ""}{place.department}</option>)}</select></label>}
      {context.status === "ready" && context.layer && <>
        <p className="geo-scope"><strong>{context.place?.municipality ? context.place.municipality + " · " : ""}{context.place?.department || "Colombia"}</strong> · {context.layer.description}</p>
        <p className="geo-warning">{context.layer.warning}</p>{context.warnings.map((message, index) => <p className="geo-warning" role="status" key={index}>{message}</p>)}
        <MapRenderer context={context} input={{ ...input, layer: context.layer.id, display: context.display }}/><MapLegend context={context}/>
        <p className="muted small">Filtros y conteo independientes de Algolia. Se consulta solo el área visible; líneas y polígonos pueden estar simplificados. No se almacena ni indexa esta capa permanentemente.</p>
      </>}
    </>}</>}
  </section>;
}
