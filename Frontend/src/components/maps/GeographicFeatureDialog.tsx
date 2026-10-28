import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { MapFeature, MapLayer } from "../../../../shared/geography";
export function GeographicFeatureDialog({ feature, layer, close }: { feature: MapFeature | null; layer: MapLayer; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { if (feature) ref.current?.showModal(); else ref.current?.close(); }, [feature]);
  return <dialog className="geo-detail" ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); close(); }}>
    <header><span className="source-tag">UPME</span><button className="icon-button" aria-label="Cerrar detalle geográfico" onClick={close}><X size={20}/></button></header>
    <h2 id={titleId}>{feature?.properties.title}</h2><p className="muted small">{layer.title}</p>
    <dl>{feature?.properties.facts.map((fact, index) => <div key={index}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
    <p className="geo-warning">{layer.warning}</p><p className="muted small">{layer.attribution}. Las geometrías proceden del servicio oficial; líneas y polígonos pueden estar simplificados para su visualización.</p>
    <a className="button secondary" href={layer.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar geovisor oficial UPME ↗</a>
  </dialog>;
}
