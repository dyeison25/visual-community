import { useCallback, useEffect, useRef, useState } from "react";
import { GeoJSON, ImageOverlay, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L, { type LatLng } from "leaflet";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import type { GeographyInput, GeoBounds, MapContext, MapFeature } from "../../../../shared/geography";
import { geographyParams, geographyService } from "../../services/geographyService";
import { useResource } from "../../hooks/useResource";
import { Empty, ErrorState, Loading } from "../UI";
import { GeographicFeatureDialog } from "./GeographicFeatureDialog";
type Selection = { feature: MapFeature; position: LatLng };
function Viewport({ bounds, change }: { bounds: GeoBounds | null; change: (value: GeoBounds) => void }) {
  const map = useMap(); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emit = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const b = map.getBounds(); const tuple: GeoBounds = [Math.max(-180, b.getWest()), Math.max(-85, b.getSouth()), Math.min(180, b.getEast()), Math.min(85, b.getNorth())];
      if (tuple[0] < tuple[2] && tuple[1] < tuple[3]) change(tuple.map(n => Number(n.toFixed(5))) as GeoBounds);
    }, 300);
  }, [map, change]);
  useMapEvents({ moveend: emit });
  useEffect(() => {
    if (bounds) map.fitBounds([[bounds[1], bounds[0]], [bounds[3], bounds[2]]], { padding: [18, 18], maxZoom: 12, animate: false });
    emit(); return () => { if (timer.current) clearTimeout(timer.current); };
  }, [map, bounds, emit]);
  return null;
}
function VectorLayer({ input, bbox, select, loaded }: { input: GeographyInput; bbox: GeoBounds | null; select: (value: Selection) => void; loaded: (features: MapFeature[]) => void }) {
  const key = geographyParams({ ...input, ...(bbox ? { bbox } : {}) }).toString();
  const resource = useResource(useCallback(async (signal: AbortSignal) => bbox ? { key, data: await geographyService.features({ ...input, bbox }, signal) } : null, [key]));
  useEffect(() => { loaded(resource.data?.key === key ? resource.data.data.features : []); }, [resource.data, key, loaded]);
  if (!bbox || resource.loading || resource.data?.key !== key && !resource.error) return <div className="geo-map-status"><Loading label="Cargando geometrías oficiales…"/></div>;
  if (resource.error) return <div className="geo-map-status"><ErrorState message={resource.error} retry={resource.refresh}/></div>;
  const data = resource.data?.data;
  return <>{data && <GeoJSON key={key + data.fetchedAt} data={data as unknown as FeatureCollection}
    pointToLayer={(_feature, latlng) => L.circleMarker(latlng, { radius: 6, weight: 1.5 })}
    style={feature => ({ color: feature?.properties?.color || "#315c44", fillColor: feature?.properties?.color || "#315c44", fillOpacity: 0.48, weight: 2 })}
    onEachFeature={(feature, layer) => layer.on("click", (e: L.LeafletMouseEvent) => select({ feature: feature as unknown as MapFeature, position: e.latlng }))}/>}
    <div className="geo-map-status" role="status">{data?.features.length ? <p>{data.features.length} elementos cargados en el área visible.{data.truncated && " Es una muestra limitada; acerca el mapa para consultar un área menor."}{!!data.discarded && " Se omitieron registros sin geometría válida."}</p> : <Empty>No hay geometrías disponibles con estos filtros en el área visible. Puedes alejar el mapa o cambiar los filtros.</Empty>}</div>
  </>;
}
function WmsLayer({ input, bbox, select }: { input: GeographyInput; bbox: GeoBounds | null; select: (value: Selection) => void }) {
  const key = geographyParams({ ...input, ...(bbox ? { bbox } : {}) }).toString();
  const resource = useResource(useCallback(async (signal: AbortSignal) => bbox ? { key, image: await geographyService.wms({ ...input, bbox }, signal) } : null, [key]));
  const [image, setImage] = useState<{ key: string; url: string; bounds: GeoBounds } | null>(null);
  const [detailError, setDetailError] = useState(""); const detail = useRef<AbortController | null>(null);
  useEffect(() => { const data = resource.data; if (!data) return; const url = URL.createObjectURL(data.image.blob); setImage({ key: data.key, url, bounds: data.image.bounds }); return () => URL.revokeObjectURL(url); }, [resource.data]);
  useEffect(() => { setDetailError(""); return () => detail.current?.abort(); }, [key]);
  useMapEvents({ click: e => {
    detail.current?.abort(); const controller = new AbortController(); detail.current = controller; setDetailError("");
    const { lng, lat } = e.latlng;
    void geographyService.features({ ...input, bbox: [lng - 0.00001, lat - 0.00001, lng + 0.00001, lat + 0.00001] }, controller.signal).then(data => {
      if (controller.signal.aborted) return;
      if (data.features.length === 1) select({ feature: data.features[0], position: e.latlng });
      else setDetailError(data.features.length ? "Hay varios polígonos en este punto. Usa la vista de geometrías para elegir uno." : "No hay un registro geográfico disponible en ese punto.");
    }).catch(error => { if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : "No pudimos consultar ese punto."); });
  } });
  return <>{image?.key === key && <ImageOverlay url={image.url} bounds={[[image.bounds[1], image.bounds[0]], [image.bounds[3], image.bounds[2]]]} opacity={0.8}/>}
    <div className="geo-map-status">{resource.error ? <ErrorState message={resource.error} retry={resource.refresh}/> : resource.loading || image?.key !== key ? <Loading label="Cargando capa temática oficial…"/> : <p role="status">Capa WMS oficial. Pulsa un punto para consultar sus datos o cambia a geometrías para explorar polígonos.</p>}{detailError && <p role="status">{detailError}</p>}</div>
  </>;
}
export function MapRenderer({ context, input }: { context: MapContext; input: GeographyInput }) {
  const [bbox, setBbox] = useState<GeoBounds | null>(null); const [selection, setSelection] = useState<Selection | null>(null); const [detail, setDetail] = useState<MapFeature | null>(null); const [tilesError, setTilesError] = useState(false);
  const [records, setRecords] = useState<MapFeature[]>([]);
  const change = useCallback((value: GeoBounds) => { setBbox(previous => previous?.join(",") === value.join(",") ? previous : value); setSelection(null); }, []);
  if (!context.layer) return null;
  return <><div className="geo-map-frame" aria-label={"Mapa contextual: " + context.layer.title}>
    <MapContainer center={[4.5, -73.5]} zoom={5} minZoom={4} maxZoom={16} scrollWheelZoom={false} preferCanvas className="geo-map">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · UPME' eventHandlers={{ tileerror: () => setTilesError(true) }}/>
      <Viewport bounds={context.bounds || context.coverageBounds || null} change={change}/>
      {context.display === "wms" ? <WmsLayer input={input} bbox={bbox} select={setSelection}/> : <VectorLayer input={input} bbox={bbox} select={setSelection} loaded={setRecords}/>}
      {selection && <Popup position={selection.position} eventHandlers={{ remove: () => setSelection(null) }}><strong>{selection.feature.properties.title}</strong>
        {selection.feature.properties.facts.slice(0, 3).map((fact, index) => <p key={index}>{fact.label}: {fact.value}</p>)}<p>Fuente: UPME</p>
        <button className="text-button" onClick={() => setDetail(selection.feature)}>Ver información</button></Popup>}
    </MapContainer>
  </div>{tilesError && <p className="muted small" role="status">El fondo cartográfico no se cargó por completo. La capa energética conserva sus datos oficiales.</p>}
    {context.display === "vector" && records.length > 0 && <details className="geo-records"><summary>Consultar elementos cargados ({records.length})</summary><p className="muted small">También puedes abrir los detalles con teclado. {records.length > 50 && "Esta lista muestra los primeros 50 elementos del área visible."}</p><ul>{records.slice(0, 50).map(record => <li key={record.id}><button className="text-button" onClick={() => setDetail(record)}>{record.properties.title}</button></li>)}</ul></details>}
    <GeographicFeatureDialog feature={detail} layer={context.layer} close={() => setDetail(null)}/></>;
}
