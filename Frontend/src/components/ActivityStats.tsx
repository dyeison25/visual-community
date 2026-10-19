import type { UserMetrics } from "../../../shared/models";
/** Tarjetas reutilizadas exclusivamente dentro de las rutas administrativas. */
export function ActivityStats({ metrics, totalUsers }: { metrics: Pick<UserMetrics, "totalInteractions" | "contentViews" | "logins">; totalUsers?: number }) {
  const items: [number, string][] = [
    ...(totalUsers !== undefined ? [[totalUsers, "Usuarios registrados"] as [number, string]] : []),
    [metrics.totalInteractions, "Interacciones registradas"],
    [metrics.contentViews, "Consultas de contenidos"], [metrics.logins, "Inicios de sesión"],
  ];
  return <div className={"activity-stats " + (totalUsers !== undefined ? "admin-stats" : "")}>{items.map(([value, label]) =>
    <div className="card" key={label}><strong>{value.toLocaleString("es-CO")}</strong><span>{label}</span></div>)}</div>;
}
