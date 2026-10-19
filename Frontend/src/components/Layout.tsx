import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { LayoutDashboard, Users, Scale, ChartNoAxesCombined, UserRound, LogOut, Menu, X, ArrowUpRight, Leaf, ChevronRight, ShieldCheck, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Brand } from "./Brand";
import { Notice } from "./UI";
import { usingEmulators } from "../config/firebase";
import { interactionService } from "../services/interactionService";
import { ChatWidget } from "./ChatWidget";
const navigation = [
  { to: "/buscar", name: "Buscar información", icon: Search },
  { to: "/", name: "Inicio", icon: LayoutDashboard },
  { to: "/comunidades", name: "Comunidades energéticas", icon: Users },
  { to: "/normativa", name: "Normativa", icon: Scale },
  { to: "/datos", name: "Datos del sector", icon: ChartNoAxesCombined },
  { to: "/perfil", name: "Mi perfil", icon: UserRound },
];
/**
 * SessionRoute ya comprobó la sesión y el perfil.
 * Solo muestra las secciones de la plataforma cuando la encuesta está completa.
 * Express y Firestore verifican por separado el acceso a sus datos.
 */
export function ProtectedRoute() {
  const { profile } = useAuth();
  // SessionRoute ya recuperó la sesión y el perfil.
  return profile?.onboardingCompleted === true ? <Layout/> : <Navigate to="/bienvenida" replace/>;
}
function Layout() {
  const { user, profile, logout, notice, setNotice, busy } = useAuth();
  const [menu, setMenu] = useState(false); const location = useLocation();
  const sync = useSyncExternalStore(interactionService.subscribe, interactionService.getStatus);
  const name = profile?.name || user?.displayName || "Miembro";
  const menuItems = profile?.role === "admin" ? [...navigation, { to: "/admin", name: "Administración", icon: ShieldCheck }] : navigation;
  const section = location.pathname.startsWith("/admin") ? "Administración" : menuItems.find(item => item.to === location.pathname)?.name || "Visual Community";
  useEffect(() => { setMenu(false); document.title = section + " · Visual Community"; }, [location.pathname, section]);
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    {menu && <button className="sidebar-overlay" aria-label="Cerrar navegación" onClick={() => setMenu(false)}/>}
    <aside className={"sidebar " + (menu ? "is-open" : "")} aria-label="Navegación principal">
      <Link to="/" className="brand-link"><Brand/></Link><button className="mobile-close icon-button" onClick={() => setMenu(false)} aria-label="Cerrar menú"><X/></button>
      <p className="nav-caption">TU ESPACIO DE ENERGÍA</p>
      <nav>{menuItems.map(({ to, name, icon: Icon }) => <NavLink key={to} to={to} end={to === "/"}><Icon size={20}/><span>{name}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="icon-tile"><Leaf size={21}/></span><strong>El cambio se construye<br/>en comunidad.</strong><p>Explora, aprende y conecta con la transición energética.</p><Link to="/comunidades">Descubre cómo <ArrowUpRight size={16}/></Link></div><div className="sidebar-user"><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong><span>Miembro de la comunidad</span></div></div></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="Abrir menú" aria-expanded={menu} onClick={() => setMenu(true)}><Menu/></button><span className="desktop-label">Mi plataforma</span><ChevronRight size={14} className="desktop-label"/><strong>{section}</strong></div><div className="topbar-right"><Link className="icon-button search-launcher" to="/buscar" aria-label="Buscar en la plataforma"><Search size={19}/></Link><span className="country"><span className="colombia-flag"/>Colombia</span><span className="topbar-divider"/><Link to="/perfil" className="avatar small-avatar" aria-label="Ver mi perfil">{name.slice(0, 1).toUpperCase()}</Link><button className="button secondary logout-button" disabled={busy} onClick={() => void logout().catch(() => setNotice("No pudimos cerrar la sesión. Intenta de nuevo."))}><LogOut size={16}/><span>Cerrar sesión</span></button></div></header>
    <main id="main-content" tabIndex={-1}>
      {usingEmulators && <Notice>Entorno de prueba local · Las cuentas y la actividad se guardan en emuladores. Los datos del sector provienen de fuentes oficiales reales.</Notice>}
      {location.state?.accessDenied && <Notice>La sección Administración requiere permisos de administrador.</Notice>}
      {notice && <Notice dismiss={() => setNotice("")}>{notice}</Notice>}
      {sync !== "ready" && <div className="sync-note" role="status">{sync === "pending" ? "Sincronizando tu actividad…" : "Parte de tu actividad no se pudo guardar. Puedes continuar usando la plataforma."}</div>}
      <Outlet/>
      <ChatWidget key={user?.uid}/>
    </main><footer className="footer"><span>© {new Date().getFullYear()} Visual Community</span><span>Plataforma independiente · Información de fuentes oficiales</span></footer></div>
  </div>;
}
