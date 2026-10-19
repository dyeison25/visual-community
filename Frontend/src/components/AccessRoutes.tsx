import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ErrorState, Loading } from "./UI";
/** Un fallo al recuperar el perfil nunca concede acceso a una ruta privada. */
export function SessionRoute() {
  const { user, loading, busy, profileLoading, profileError, profile, retryProfile, logout, setNotice } = useAuth();
  const location = useLocation();
  if (loading || busy) return <Loading label="Preparando tu espacio…"/>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace/>;
  if (profileLoading) return <Loading label="Preparando tu perfil…"/>;
  if (profileError || !profile) return <div className="access-message">
    <ErrorState message="No pudimos recuperar tu perfil. Reintenta para continuar." retry={retryProfile}/>
    <button className="button secondary" onClick={() => void logout().catch(() => setNotice("No pudimos cerrar la sesión."))}>Cerrar sesión</button>
  </div>;
  return <Outlet/>;
}
/** Express y Firestore verifican el rol además de este control visual. */
export function AdminRoute() {
  const { profile } = useAuth();
  return profile?.role === "admin" ? <Outlet/> : <Navigate to="/" state={{ accessDenied: true }} replace/>;
}
