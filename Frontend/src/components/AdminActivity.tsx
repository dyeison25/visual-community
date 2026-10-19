import { Link } from "react-router-dom";
import type { Interaction } from "../../../shared/models";
import { EVENT_LABELS } from "../../../shared/admin";
import { dateLabel, Empty } from "./UI";
export function AdminActivity({ events, showUser = false }: { events: Interaction[]; showUser?: boolean }) {
  if (!events.length) return <Empty>No hay actividad registrada para mostrar.</Empty>;
  return <ul className="activity-list admin-activity">{events.map(event => <li key={event.userId + ":" + event.id}>
    <span className="activity-dot"/><div><strong>{EVENT_LABELS[event.eventType] || "Actividad registrada"}</strong>
      <span>{event.source || "Visual Community"}{event.contentId ? " · " + event.contentId : ""}</span>
      <code>{event.eventType}</code>{showUser && <Link className="text-link" to={"/admin/usuarios/" + encodeURIComponent(event.userId)}>Ver cuenta</Link>}
    </div><time>{event.timestamp ? dateLabel(event.timestamp) + " · " + new Date(event.timestamp).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "Fecha no disponible"}</time>
  </li>)}</ul>;
}
