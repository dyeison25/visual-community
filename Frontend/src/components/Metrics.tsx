import { useId } from "react";
import { Zap, Activity, TrendingUp, ArrowUpRight } from "lucide-react";
import type { EnergyMetric, MetricPoint } from "../../../shared/models";
import { dateLabel } from "./UI";
export const metricNumber = (value: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
export function Sparkline({ points }: { points: MetricPoint[] }) {
  const id = useId().replace(/:/g, "");
  if (points.length < 2) return null;
  const values = points.map(point => point.value); const low = Math.min(...values); const range = Math.max(...values) - low || 1;
  const line = points.map((point, i) => `${(i / (points.length - 1)) * 120},${34 - (point.value - low) / range * 28}`).join(" ");
  return <svg viewBox="0 0 120 40" className="sparkline" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#2c7a58" stopOpacity=".15"/><stop offset="1" stopColor="#2c7a58" stopOpacity="0"/></linearGradient></defs><polygon points={`0,40 ${line} 120,40`} fill={`url(#${id})`}/><polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/></svg>;
}
export function MetricCards({ metrics, onSelect, compact = false }: { metrics: EnergyMetric[]; onSelect: (id: string) => void; compact?: boolean }) {
  const icons = [Zap, Activity, TrendingUp];
  return <div className={"metric-grid " + (compact ? "compact" : "")}>{metrics.map((metric, i) => { const Icon = icons[i] || Zap; return <button className="card metric-card" key={metric.id} onClick={() => onSelect(metric.id)} aria-label={"Ver " + metric.name}><div className="metric-top"><span className={"icon-tile metric-icon-" + i}><Icon size={19}/></span><span>{metric.name}</span><ArrowUpRight size={16}/></div><div className="metric-value">{metric.value === null ? <span className="no-value">Sin datos</span> : metricNumber(metric.value)}<small>{metric.unit}</small></div>{!compact && <div className="metric-chart-row"><div><span className="metric-date">{metric.date ? dateLabel(metric.date) : "Consulta no disponible"}</span><small>{metric.status === "ok" ? metric.aggregation : metric.message}</small></div><Sparkline points={metric.series}/></div>}<div className="metric-source"><span className={"status-dot " + (metric.status === "ok" ? "" : "unavailable")}/>Fuente: XM · Sinergox</div></button>; })}</div>;
}
export function MetricChart({ metric }: { metric: EnergyMetric }) {
  const id = useId().replace(/:/g, ""); const points = metric.series;
  if (!points.length) return <div className="empty-state">No hay días completos disponibles para dibujar esta serie.</div>;
  const width = 760, height = 230, left = 65, right = 20, top = 20, bottom = 35;
  const values = points.map(point => point.value); const min = Math.min(...values), max = Math.max(...values);
  const margin = Math.max((max - min) * .2, max * .01, .01); const low = Math.max(0, min - margin), high = max + margin;
  const x = (i: number) => left + (points.length === 1 ? .5 : i / (points.length - 1)) * (width - left - right);
  const y = (value: number) => top + (1 - (value - low) / (high - low || 1)) * (height - top - bottom);
  const line = points.map((point, i) => `${x(i)},${y(point.value)}`).join(" ");
  return <div className="chart-container"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={metric.name + ", serie diaria en " + metric.unit + ". Los valores exactos están en la tabla."}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8fb584" stopOpacity=".32"/><stop offset="1" stopColor="#8fb584" stopOpacity=".03"/></linearGradient></defs>{Array.from({ length: 5 }, (_, i) => { const value = low + (high - low) * i / 4; return <g key={i}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#e8ece5" strokeDasharray="4 4"/><text x={left - 12} y={y(value) + 4} textAnchor="end" fill="#738078" fontSize="11">{metricNumber(value)}</text></g>; })}<polygon points={`${x(0)},${height - bottom} ${line} ${x(points.length - 1)},${height - bottom}`} fill={`url(#${id})`}/><polyline points={line} stroke="#377b58" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>{points.map((point, i) => <g key={point.date}><circle cx={x(i)} cy={y(point.value)} r="3.5" fill="#fff" stroke="#377b58" strokeWidth="2"><title>{dateLabel(point.date)}: {metricNumber(point.value)} {metric.unit}</title></circle>{(i === 0 || i === points.length - 1 || i % 3 === 0) && <text x={x(i)} y={height - 10} textAnchor="middle" fill="#738078" fontSize="11">{point.date.slice(8) + "/" + point.date.slice(5, 7)}</text>}</g>)}</svg><p className="chart-caption">Eje vertical: {metric.unit} · Eje horizontal: fecha · {metric.aggregation}</p></div>;
}
