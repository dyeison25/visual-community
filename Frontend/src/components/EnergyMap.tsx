import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { EnergyCommunity } from "../../../shared/models";
import { energyService } from "../services/energyService";
import { interactionService } from "../services/interactionService";
import { useResource } from "../hooks/useResource";
import { CommunityDialog } from "./CommunityDialog";
import { Empty, ErrorState, Loading, SourceLink } from "./UI";
function Markers({ rows, select }: { rows: EnergyCommunity[]; select:(row:EnergyCommunity)=>void }) {
  const map=useMap();
  useEffect(()=>{
    const renderer=L.canvas({padding:0.3}); const group=L.layerGroup().addTo(map);
    for(const row of rows) if(row.latitude!==null && row.longitude!==null) {
      L.circleMarker([row.latitude,row.longitude],{renderer,radius:5,color:"#315c44",weight:1,fillColor:"#9cbd63",fillOpacity:0.85})
        .on("click",()=>select(row)).addTo(group);
    }
    return ()=>{ group.remove(); renderer.remove(); };
  },[map,rows,select]);
  return null;
}
import { useCallback } from "react";
export default function EnergyMap() {
  const resource=useResource(energyService.map);
  const [tilesError,setTilesError]=useState(false);
  const [selected,setSelected]=useState<EnergyCommunity|null>(null);
  const [detail,setDetail]=useState<EnergyCommunity|null>(null);
  const select=useCallback((row:EnergyCommunity)=>{
    setSelected(row);
    void interactionService.track({eventType:"CLICK_ENERGY_COMMUNITY_MARKER",contentId:row.id,source:"MinEnergía",metadata:{category:"energy_communities"}});
  },[]);
  useEffect(()=>{if(resource.data?.status==="ok") void interactionService.track({eventType:"VIEW_ENERGY_MAP",source:"MinEnergía",metadata:{category:"energy_communities"}});},[resource.data]);
  if(resource.loading)return <Loading label="Cargando el mapa oficial de Colombia…"/>;
  if(resource.error || resource.data?.status==="unavailable")return <ErrorState message={resource.error || resource.data?.message || "No pudimos cargar el mapa."} retry={resource.refresh}/>;
  const rows=resource.data?.data || [];
  const count=rows.filter(row=>row.latitude!==null && row.longitude!==null).length;
  return <section className="card energy-map-card" aria-label="Mapa de comunidades energéticas">
    <p className="muted small">{count.toLocaleString("es-CO")} ubicaciones oficiales · Ministerio de Minas y Energía. {rows.length-count>0 && (rows.length-count)+" registros sin coordenadas válidas."}</p>
    {count ? <MapContainer center={[4.5,-73.5]} zoom={5} minZoom={3} maxZoom={18} scrollWheelZoom={false} className="energy-map">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' eventHandlers={{tileerror:()=>setTilesError(true)}}/>
      <Markers rows={rows} select={select}/>
      {selected && selected.latitude!==null && selected.longitude!==null && <Popup position={[selected.latitude,selected.longitude]} eventHandlers={{remove:()=>setSelected(null)}}>
        <strong>{selected.name}</strong><p>{selected.municipality}, {selected.department}</p><p>{selected.status || "Sin estado publicado"}</p><p>{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</p>
        <p>Ministerio de Minas y Energía</p><button className="text-button" onClick={()=>setDetail(selected)}>Ver información</button>
        <SourceLink url={selected.sourceUrl} source="MinEnergía" contentId={selected.id}>Consultar fuente oficial</SourceLink>
      </Popup>}
    </MapContainer> : <Empty>No hay coordenadas disponibles.</Empty>}
    {tilesError&&<p className="muted small" role="status">El fondo cartográfico no se pudo cargar completamente. Los marcadores conservan las coordenadas oficiales.</p>}
    <p className="muted small">Incluye postulaciones; no confirma proyectos ejecutados. Usa + y − para ampliar. También puedes buscar y consultar las comunidades en su sección.</p>
    <CommunityDialog community={detail} close={()=>setDetail(null)}/>
  </section>;
}
