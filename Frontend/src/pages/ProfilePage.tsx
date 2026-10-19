import { useEffect, useState, type FormEvent } from "react";
import { UserRound, Save, Pencil, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { profileService } from "../services/profileService";
import { interactionService } from "../services/interactionService";
import { profileTopics, topicLabel, formatLabel, validatePreferences } from "../../../shared/preferences";
import { PreferenceFields } from "../components/PreferenceFields";
import { dateLabel, ErrorState, Notice, PageHeading, SectionHeading } from "../components/UI";
/** Mi perfil contiene datos de cuenta y preferencias; el seguimiento se consulta en Administración. */
export function ProfilePage() {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.name || user?.displayName || "");
  const [compact, setCompact] = useState(profile?.preferences.compactMetrics || false);
  const [topics, setTopics] = useState(() => profileTopics(profile));
  const [formats, setFormats] = useState(profile?.preferences.formats || []);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    if (profile) { setName(profile.name); setCompact(profile.preferences.compactMetrics); setTopics(profileTopics(profile)); setFormats(profile.preferences.formats || []); }
  }, [profile]);
  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (name.trim().length < 2 || name.trim().length > 80) { setError("Tu nombre debe tener entre 2 y 80 caracteres."); return; }
    setBusy(true);
    try {
      await profileService.save(user!.uid, name, compact);
      await interactionService.track({ eventType: "UPDATE_PROFILE" });
      setMessage("Tu perfil se guardó correctamente.");
    } catch { setError("No pudimos confirmar el guardado de tu perfil. Revisa tu conexión y vuelve a intentar."); }
    finally { setBusy(false); }
  }
  async function savePreferences(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const invalid = validatePreferences(topics, formats);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      await profileService.savePreferences(user!.uid, topics, formats);
      await interactionService.track({ eventType: "SELECT_PREFERENCES", metadata: { section: "profile" } });
      setEditing(false); setMessage("Tus preferencias se actualizaron correctamente.");
    } catch { setError("No pudimos confirmar tus preferencias. Intenta nuevamente."); }
    finally { setBusy(false); }
  }
  return <><PageHeading title="Este es tu espacio." description="Gestiona tu cuenta y elige los temas que quieres descubrir."/>
    {message && <Notice>{message}</Notice>}{error && <ErrorState message={error}/>}
    <div className="profile-grid"><section className="card profile-form">
      <SectionHeading title="Mi perfil" eyebrow="TU CUENTA"/>
      <form onSubmit={save} noValidate>
        <label>Nombre<span className="input-wrap"><UserRound size={18}/><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={80}/></span></label>
        <label>Correo de tu cuenta<input className="plain-input" value={user?.email || ""} readOnly/></label>
        <label className="checkbox-label preference"><input type="checkbox" checked={compact} onChange={e => setCompact(e.target.checked)}/><span><strong>Indicadores compactos en Inicio</strong><small>Muestra las cifras principales sin minigráficos.</small></span></label>
        <button className="button primary" disabled={busy} type="submit"><Save size={17}/>{busy ? "Guardando…" : "Guardar cambios"}</button>
      </form>
    </section><aside className="profile-side">
      <div className="identity-card"><span className="avatar account-avatar">{(profile?.name || "M").slice(0, 1).toUpperCase()}</span><h2>{profile?.name || "Miembro"}</h2><p>{user?.email}</p>
        <span className="eyebrow">MIEMBRO DESDE</span><p>{user?.metadata.creationTime ? dateLabel(new Date(user.metadata.creationTime).toISOString()) : "Fecha no disponible"}</p>
        <span className="account-security"><ShieldCheck size={17}/>Cuenta protegida con Firebase</span>
      </div>
      <div className="card profile-tip"><h3>Tus intereses cuentan.</h3><p>Puedes actualizar tus elecciones cuando quieras. Se usarán para preparar información más relevante para ti.</p></div>
    </aside></div>
    <section className="card preferences-card"><SectionHeading title="Mis preferencias" eyebrow="CONTENIDO QUE TE INTERESA">
      {!editing && <button className="text-button" onClick={() => { setEditing(true); setError(""); setMessage(""); }}><Pencil size={16}/>Editar mis preferencias</button>}
    </SectionHeading>
    {editing ? <form onSubmit={savePreferences} noValidate>
      <PreferenceFields topics={topics} formats={formats} onTopics={setTopics} onFormats={setFormats} disabled={busy}/>
      <div className="form-actions"><button className="button primary" disabled={busy} type="submit">Guardar preferencias</button><button className="button secondary" disabled={busy} type="button" onClick={() => { setEditing(false); setTopics(profileTopics(profile)); setFormats(profile?.preferences.formats || []); }}>Cancelar</button></div>
    </form> : <><div className="tag-list">{profileTopics(profile).map(id => <span className="soft-tag" key={id}>{topicLabel(id)}</span>)}</div>
      {!profileTopics(profile).length && <p className="muted">Aún no has elegido temas.</p>}
      <p className="muted small preference-caption">Contenido preferido</p><div className="tag-list">{profile?.preferences.formats?.length ? profile.preferences.formats.map(id => <span className="soft-tag" key={id}>{formatLabel(id)}</span>) : <p className="muted small">Sin preferencia de formato.</p>}</div></>}
    </section>
  </>;
}
