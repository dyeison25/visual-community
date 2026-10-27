import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Leaf, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { profileService } from "../services/profileService";
import { interactionService } from "../services/interactionService";
import { profileTopics, validatePreferences } from "../../../shared/preferences";
import { PreferenceFields } from "../components/PreferenceFields";
import { Brand } from "../components/Brand";
import { ErrorState } from "../components/UI";
import { notificationService } from "../services/notificationService";
/** La encuesta se omite únicamente cuando Firestore confirma onboardingCompleted. */
export function OnboardingPage() {
  const { user, profile, logout } = useAuth(); const navigate = useNavigate();
  const [topics, setTopics] = useState(() => profileTopics(profile));
  const [formats, setFormats] = useState(profile?.preferences.formats || []);
  const [emailNotifications, setEmailNotifications] = useState(profile?.emailNotifications?.enabled || false);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  if (profile?.onboardingCompleted && !saving) return <Navigate to="/" replace/>;
  async function submit(event: FormEvent) {
    event.preventDefault(); const invalid = validatePreferences(topics, formats);
    if (invalid) { setError(invalid); return; }
    setSaving(true); setError("");
    try {
      // Si no acepta y nunca existió consentimiento, el valor ya es false; no bloquea la encuesta por una API fría.
      if (emailNotifications || profile?.emailNotifications?.enabled) await notificationService.setConsent(emailNotifications, "onboarding");
      await profileService.savePreferences(user!.uid, topics, formats);
      await interactionService.track({ eventType: "COMPLETE_ONBOARDING", metadata: { section: "onboarding" } });
      navigate("/", { replace: true });
    } catch { setError("No pudimos confirmar tus preferencias. Revisa la conexión y vuelve a intentar."); }
    finally { setSaving(false); }
  }
  return <div className="onboarding-page">
    <header className="onboarding-header"><Brand/><button className="text-button" disabled={saving} onClick={() => void logout().catch(() => setError("No pudimos cerrar la sesión."))}><LogOut size={17}/>Cerrar sesión</button></header>
    <main className="onboarding-card card">
      <div className="onboarding-intro"><span className="icon-tile"><Leaf size={27}/></span><div><p className="eyebrow">BIENVENIDO A TU COMUNIDAD</p><h1>La energía que te interesa.</h1><p>Cuéntanos qué quieres descubrir. Te tomará un minuto y podrás cambiarlo después en Mi perfil.</p></div></div>
      {error && <ErrorState message={error}/>}
      <form onSubmit={submit} noValidate>
        <PreferenceFields topics={topics} formats={formats} onTopics={setTopics} onFormats={setFormats} disabled={saving}/>
        <label className="checkbox-label preference"><input type="checkbox" checked={emailNotifications} onChange={event => setEmailNotifications(event.target.checked)} disabled={saving}/><span><strong>Recibir recordatorios por correo</strong><small>Te escribiremos solo si llevas varios días sin ingresar. Puedes retirarlo cuando quieras desde Mi perfil o desde cada correo.</small></span></label>
        <div className="onboarding-footer"><p className="muted small">Tus elecciones nos ayudarán a preparar contenidos más relevantes para ti.</p><button className="button primary" disabled={saving} type="submit">{saving ? "Guardando preferencias…" : "Guardar y continuar"}<ArrowRight size={18}/></button></div>
      </form>
    </main>
  </div>;
}
