import type { MapContext } from "../../../../shared/geography";
export function MapLegend({ context }: { context: MapContext }) {
  if (!context.layer) return null;
  return <div className="geo-legend" aria-label="Leyenda del mapa">
    <strong>Leyenda · {context.layer.units}</strong>
    <ul>{context.legend.map((entry, index) => <li key={index}><span style={{ background: entry.color }} aria-hidden="true"/>{entry.label}</li>)}</ul>
    <p>{context.layer.period}</p><p>{context.layer.attribution}</p>
    <a className="source-link" href={context.layer.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar geovisor oficial UPME ↗</a>
  </div>;
}
