import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SessionRoute, AdminRoute } from "./components/AccessRoutes";
import { OnboardingPage } from "./pages/OnboardingPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminUserPage } from "./pages/AdminUserPage";
import { ProtectedRoute } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { CommunitiesPage } from "./pages/CommunitiesPage";
import { RegulationsPage } from "./pages/RegulationsPage";
import { SectorPage } from "./pages/SectorPage";
import { ProfilePage } from "./pages/ProfilePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SearchPage } from "./pages/SearchPage";
import { UnsubscribePage } from "./pages/UnsubscribePage";
export function App() {
  return <BrowserRouter><AuthProvider><Routes><Route path="/login" element={<AuthPage key="login" mode="login"/>}/><Route path="/registro" element={<AuthPage key="register" mode="register"/>}/><Route path="/recuperar" element={<AuthPage key="reset" mode="reset"/>}/><Route path="/privacidad" element={<PrivacyPage/>}/><Route path="/notificaciones/baja" element={<UnsubscribePage/>}/><Route element={<SessionRoute/>}><Route path="/bienvenida" element={<OnboardingPage/>}/><Route element={<ProtectedRoute/>}><Route element={<AdminRoute/>}><Route path="/admin" element={<AdminPage/>}/><Route path="/admin/usuarios/:uid" element={<AdminUserPage/>}/></Route><Route index element={<Dashboard/>}/><Route path="/buscar" element={<SearchPage/>}/><Route path="/comunidades" element={<CommunitiesPage/>}/><Route path="/normativa" element={<RegulationsPage/>}/><Route path="/datos" element={<SectorPage/>}/><Route path="/perfil" element={<ProfilePage/>}/><Route path="*" element={<div className="empty-state"><h1>No encontramos esta página.</h1><Link className="button primary" to="/">Volver al inicio</Link></div>}/></Route></Route></Routes></AuthProvider></BrowserRouter>;
}
