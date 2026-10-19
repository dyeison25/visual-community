import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { adminService } from "../services/adminService";
import { useResource } from "../hooks/useResource";
import { ActivityStats } from "../components/ActivityStats";
import { AdminActivity } from "../components/AdminActivity";
import { PageHeading, SectionHeading, Loading, ErrorState, dateLabel } from "../components/UI";
import { topicLabel, formatLabel } from "../../../shared/preferences";
export function AdminUserPage() {
  const { uid = "" } = useParams();
  const resource = useResource(useCallback((signal: AbortSignal) => adminService.user(uid, signal), [uid]));
  return <><Link className="text-link back-link" to="/admin"><ArrowLeft size={16}/>Volver a Administración</Link>
    <PageHeading title="Detalle de usuario" description="Preferencias declaradas y actividad registrada de esta cuenta."/>
    {resource.loading ? <Loading label="Consultando la cuenta y su actividad…"/> : resource.error ? <ErrorState message={resource.error} retry={resource.refresh}/> : resource.data && <>
      <section className="card admin-user-card"><div className="account-heading"><span className="avatar account-avatar">{resource.data.user.name.slice(0, 1).toUpperCase()}</span><div><h2>{resource.data.user.name}</h2><p className="muted">{resource.data.user.email || "Correo no disponible"}</p></div><span className="soft-tag">{resource.data.user.role === "admin" ? "Administrador" : "Usuario"}</span></div>
        <dl className="detail-facts"><div><dt>Fecha de registro</dt><dd>{dateLabel(resource.data.user.createdAt)}</dd></div><div><dt>Último acceso</dt><dd>{dateLabel(resource.data.user.lastSignInAt)}</dd></div><div><dt>Encuesta inicial</dt><dd>{resource.data.user.onboardingCompleted ? "Completada" : "Pendiente"}</dd></div></dl>
        <h3>Preferencias</h3><div className="tag-list">{resource.data.user.topics.map(id => <span className="soft-tag" key={id}>{topicLabel(id)}</span>)}</div>
        {!resource.data.user.topics.length && <p className="muted small">Todavía no ha seleccionado temas.</p>}
        <p className="muted small preference-caption">Contenido preferido: {resource.data.user.formats.length ? resource.data.user.formats.map(formatLabel).join(", ") : "Sin preferencia de formato"}</p>
      </section>
      <ActivityStats metrics={resource.data.metrics}/>
      <section className="card admin-panel"><SectionHeading title="Actividad reciente" eyebrow="ÚLTIMOS 20 EVENTOS"><button className="text-button" onClick={resource.refresh}><RefreshCw size={15}/>Actualizar</button></SectionHeading>
        <p className="muted small">Historial asociado a esta cuenta. Los contadores incluyen todas sus interacciones; este listado muestra hasta 20.</p><AdminActivity events={resource.data.recent}/>
      </section>
    </>}
  </>;
}
