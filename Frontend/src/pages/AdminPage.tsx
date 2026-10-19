import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { adminService } from "../services/adminService";
import { useResource } from "../hooks/useResource";
import { ActivityStats } from "../components/ActivityStats";
import { AdminActivity } from "../components/AdminActivity";
import { PageHeading, SectionHeading, Loading, ErrorState, Empty, dateLabel } from "../components/UI";
import { EVENT_LABELS } from "../../../shared/admin";
import type { EventType } from "../../../shared/models";
import { topicLabel } from "../../../shared/preferences";
export function AdminPage() {
  const [offset, setOffset] = useState(0);
  const overview = useResource(adminService.overview);
  const users = useResource(useCallback((signal: AbortSignal) => adminService.users(offset, signal), [offset]));
  return <><PageHeading title="Administración" description="Actividad de los usuarios de Visual Community. Las cuentas administrativas no se incluyen en las métricas ni en esta lista.">
    <span className="welcome-chip"><ShieldCheck size={16}/>Acceso administrativo</span></PageHeading>
    <div className="admin-toolbar"><p className="muted small">Los resultados se reutilizan hasta un minuto para reducir consultas.</p><button className="text-button" disabled={overview.loading || users.loading} onClick={() => { overview.refresh(); users.refresh(); }}><RefreshCw size={15}/>Actualizar</button></div>
    {overview.loading ? <Loading label="Consultando el resumen de participación…"/> : overview.error ? <ErrorState message={overview.error} retry={overview.refresh}/> : overview.data && <>
      <ActivityStats metrics={overview.data} totalUsers={overview.data.totalUsers}/>
      <p className="muted small"><strong>{overview.data.activeUsersLast7Days}</strong> usuarios con actividad en los últimos 7 días · Consulta: {dateLabel(overview.data.calculatedAt)}</p>
    </>}
    <SectionHeading title="Usuarios registrados" eyebrow="CUENTAS DE LA PLATAFORMA"/>
    {users.loading ? <Loading label="Consultando usuarios…"/> : users.error ? <ErrorState message={users.error} retry={users.refresh}/> : users.data && <>
      {!users.data.users.length ? <Empty>No hay cuentas en esta página.</Empty> : <div className="card admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Usuario</th><th scope="col">Registro y último acceso</th><th scope="col">Preferencias</th><th scope="col">Interacciones</th><th scope="col">Detalle</th></tr></thead><tbody>{users.data.users.map(user => <tr key={user.uid}>
        <td><strong>{user.name}</strong><span className="user-email">{user.email || "Correo no disponible"}</span><span className="soft-tag">{user.role === "admin" ? "Administrador" : "Usuario"}</span></td>
        <td><span>Registro: {dateLabel(user.createdAt)}</span><span className="muted small">Último acceso: {dateLabel(user.lastSignInAt)}</span></td>
        <td><div className="tag-list">{user.topics.map(id => <span className="soft-tag" key={id}>{topicLabel(id)}</span>)}</div>{!user.onboardingCompleted && <span className="muted small">Encuesta pendiente</span>}</td>
        <td>{user.totalInteractions.toLocaleString("es-CO")}</td><td><Link className="text-link" to={"/admin/usuarios/" + encodeURIComponent(user.uid)}>Ver actividad<ArrowRight size={15}/></Link></td>
      </tr>)}</tbody></table></div>}
      <div className="pagination"><button className="button secondary" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 20))}><ArrowLeft size={16}/>Anterior</button><span>Página {Math.floor(offset / 20) + 1} · {users.data.total} usuarios</span><button className="button secondary" disabled={!users.data.hasMore} onClick={() => setOffset(offset + 20)}>Siguiente<ArrowRight size={16}/></button></div>
    </>}
    {overview.data && <div className="admin-detail-grid">
      <section className="card admin-panel"><SectionHeading title="Actividad reciente" eyebrow="ÚLTIMOS 20 EVENTOS"/><AdminActivity events={overview.data.recent} showUser/></section>
      <section className="card admin-panel"><SectionHeading title="Tipos de eventos más frecuentes" eyebrow="MUESTRA RECIENTE"/>
        <p className="muted small">{overview.data.sampleDescription}</p><p className="muted small sample-count">{overview.data.sampleSize} eventos en la muestra.</p>
        {!overview.data.eventTypes.length ? <Empty>Aún no hay eventos en la muestra.</Empty> : <ul className="event-frequency">{overview.data.eventTypes.map(item => <li key={item.eventType}><div><span>{EVENT_LABELS[item.eventType as EventType] || item.eventType}</span><strong>{item.count}</strong></div><span className="frequency-track"><span style={{ width: (item.count / overview.data!.sampleSize * 100) + "%" }}/></span></li>)}</ul>}
      </section></div>}
  </>;
}
