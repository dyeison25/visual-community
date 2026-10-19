import { useEffect, useRef } from "react";
import { MapPin, X } from "lucide-react";
import type { EnergyCommunity } from "../../../shared/models";
import { SourceLink } from "./UI";
import { interactionService } from "../services/interactionService";
/** Presenta los campos públicos de la comunidad; nunca expone el endpoint técnico como enlace. */
export function CommunityDialog({ community, close }: { community: EnergyCommunity | null; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!community) return;
    const dialog = ref.current;
    dialog?.showModal();
    void interactionService.track({ eventType: "VIEW_ENERGY_COMMUNITY", contentId: community.id, source: "MinEnergía" });
    return () => dialog?.close();
  }, [community?.id]);
  return <dialog ref={ref} className="content-dialog community-dialog" aria-labelledby="community-title" onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    {community && <><div className="dialog-header"><span className="icon-tile"><MapPin/></span><button className="icon-button" aria-label="Cerrar información de comunidad" onClick={close}><X/></button></div>
      <p className="eyebrow">COMUNIDAD ENERGÉTICA</p><h2 id="community-title">{community.name}</h2>
      <dl className="detail-facts"><div><dt>Municipio</dt><dd>{community.municipality}</dd></div><div><dt>Departamento</dt><dd>{community.department}</dd></div><div><dt>Estado publicado</dt><dd>{community.status || "Sin estado publicado"}</dd></div><div><dt>Identificador del registro</dt><dd>{community.id}</dd></div>
        {community.area && <div><dt>Zona</dt><dd>{community.area}</dd></div>}
        {community.operator && <div><dt>Operador</dt><dd>{community.operator}</dd></div>}
        {community.executor && <div><dt>Ejecutor</dt><dd>{community.executor}</dd></div>}
      </dl>
      <div className="community-location"><MapPin size={21}/><div><strong>Ubicación publicada</strong><p>{community.latitude !== null && community.longitude !== null ? "Latitud: " + community.latitude.toFixed(6) + " · Longitud: " + community.longitude.toFixed(6) : "La fuente no publica coordenadas válidas para este registro."}</p></div></div>
      <div className="source-note"><strong>Ministerio de Minas y Energía</strong><p>Este registro puede corresponder a una postulación. Su presencia aquí no confirma que el proyecto esté ejecutado.</p><p>El enlace siguiente abre la información institucional de la estrategia.</p></div>
      <SourceLink url={community.sourceUrl} source="MinEnergía" contentId={community.id} className="button primary">Consultar fuente oficial</SourceLink>
    </>}
  </dialog>;
}
