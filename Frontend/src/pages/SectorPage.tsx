import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, ChartNoAxesCombined } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { energyService } from "../services/energyService";
import { interactionService } from "../services/interactionService";
import { MetricCards, MetricChart, metricNumber } from "../components/Metrics";
import { dateLabel, Empty, ErrorState, Loading, Notice, PageHeading, SectionHeading, SourceLink } from "../components/UI";
export function SectorPage() {
  const [params] = useSearchParams(); const [selected, setSelected] = useState(params.get("metrica") || "Gene");
  const resource = useResource(energyService.metrics);
  const metric = resource.data?.data.find(item => item.id === selected) || resource.data?.data[0];
  useEffect(() => { if (metric) void interactionService.track({ eventType: "VIEW_METRIC", contentId: metric.id, source: "XM", metadata: { path: "/datos" } }); }, [metric?.id]);
  return <><PageHeading title="La energía, en datos." description="Tres indicadores para entender el Sistema Interconectado Nacional de Colombia."><button className="button secondary" onClick={resource.refresh} disabled={resource.loading}><RefreshCw size={16}/>Actualizar</button></PageHeading>
    {resource.loading ? <Loading label="Consultando generación, demanda y precio en XM…"/> : resource.error ? <ErrorState message={resource.error} retry={resource.refresh}/> : resource.data && <><Notice>{resource.data.message}</Notice><MetricCards metrics={resource.data.data} onSelect={setSelected}/>
    {metric && <section className="card sector-chart"><SectionHeading title={metric.name} eyebrow="EVOLUCIÓN DIARIA"><span className="source-tag">XM · SINERGOX</span></SectionHeading><div className="chart-tabs" role="group" aria-label="Seleccionar métrica">{resource.data.data.map(item => <button key={item.id} className={metric.id === item.id ? "active" : ""} aria-pressed={metric.id === item.id} onClick={() => setSelected(item.id)}>{item.name}</button>)}</div><p className="muted">{metric.description}</p>{metric.status === "unavailable" ? <ErrorState message={metric.message || "Métrica no disponible."} retry={resource.refresh}/> : <MetricChart metric={metric}/>}<div className="chart-footer"><span className="muted small">{metric.aggregation} · Consulta: {dateLabel(resource.data.fetchedAt)}</span><SourceLink source="XM" contentId={metric.id} url={metric.sourceUrl}/></div><details className="data-table-details"><summary><ChartNoAxesCombined size={17}/>Ver valores de la serie</summary>{metric.series.length ? <div className="table-scroll"><table><caption>{metric.name} · {metric.unit}</caption><thead><tr><th>Fecha</th><th>Valor ({metric.unit})</th><th>Fuente</th></tr></thead><tbody>{[...metric.series].reverse().map(point => <tr key={point.date}><td>{dateLabel(point.date)}</td><td>{metricNumber(point.value)}</td><td>XM</td></tr>)}</tbody></table></div> : <Empty>No hay valores publicados disponibles.</Empty>}</details></section>}</>}
    <div className="method-note"><h3>Cómo leer estos indicadores</h3><p>Generación y demanda: suma de las 24 horas del día, convertida de kWh a GWh. Precio de bolsa: promedio aritmético de 24 valores horarios, en COP/kWh. Solo se muestran días completos dentro de los últimos 14 días anteriores a hoy, según la fecha de Colombia.</p><p>Son datos del sistema nacional. No representan el consumo de tu hogar, la producción de una comunidad ni tu tarifa eléctrica.</p></div></>;
}
