import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, ShieldCheck, Mail, LockKeyhole, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Brand } from "../components/Brand";
import { EnergyIllustration } from "../components/EnergyIllustration";
import { ErrorState, Loading, Notice } from "../components/UI";
import { authError } from "../services/errors";
import { validateCredentials, validEmail } from "../../../shared/validation";
import { firebaseConfigured, usingEmulators } from "../config/firebase";
export function AuthPage({ mode }: { mode: "login" | "register" | "reset" }) {
  const state = useAuth(); const location = useLocation();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false); const [consent, setConsent] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const register = mode === "register"; const reset = mode === "reset";
  if (state.loading) return <Loading label="Recuperando tu sesión…"/>;
  if (state.user && !state.busy) return <Navigate to={typeof location.state?.from === "string" && /^\/(?!\/)/.test(location.state.from) ? location.state.from : "/"} replace/>;
  /**
   * Gestiona el envío del formulario sin recargar la página.
   * Valida el correo y los campos necesarios para login, registro o recuperación.
   * En registro también comprueba la confirmación de contraseña y la aceptación del uso de datos.
   * Llama a la función de autenticación correspondiente y muestra mensajes comprensibles.
   */
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSuccess("");
    if (reset) {
      if (!validEmail(email.trim())) { setError("Escribe un correo electrónico válido."); return; }
      try { await state.resetPassword(email); setSuccess("Si existe una cuenta con este correo, recibirás las instrucciones para recuperar tu contraseña."); }
      catch (err) { setError(authError(err)); } return;
    }
    const invalid = validateCredentials(email, password, register, name);
    if (invalid) { setError(invalid); return; }
    if (register && password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (register && !consent) { setError("Acepta el uso de los datos de tu cuenta y actividad para continuar."); return; }
    try { if (register) await state.register(name, email, password); else await state.login(email, password); }
    catch (err) { setError(authError(err)); }
  }
  return <div className="auth-page"><section className="auth-story"><Brand light/><div className="auth-story-body"><span className="auth-kicker"><span/>COLOMBIA · ENERGÍA COMPARTIDA</span><h1>La transición<br/>energética<br/>empieza <em>contigo.</em></h1><p>Un espacio para descubrir, comprender y ser parte de las comunidades energéticas de Colombia.</p><EnergyIllustration className="auth-illustration"/></div><div className="auth-story-footer"><span>Conocimiento oficial.</span><span>Un futuro compartido.</span></div></section>
    <section className="auth-form-side"><div className="auth-mobile-brand"><Brand/></div><div className="auth-form-container"><p className="eyebrow">BIENVENIDO A VISUAL COMMUNITY</p><h2>{register ? "Construyamos comunidad." : reset ? "Recupera tu acceso." : "Qué bueno tenerte aquí."}</h2><p className="auth-description">{register ? "Crea tu cuenta y explora la energía que nos conecta." : reset ? "Te enviaremos las instrucciones a tu correo electrónico." : "Ingresa a tu espacio de conocimiento y energía."}</p>
    {usingEmulators && <Notice>Modo de prueba local con emuladores Firebase.</Notice>}
    {!firebaseConfigured && <Notice>La plataforma está pendiente de configurar Firebase. Completa las variables de Frontend/.env indicadas en el README para habilitar el acceso.</Notice>}
    {state.notice && <Notice>{state.notice}</Notice>}{error && <ErrorState message={error}/>} {success && <Notice>{success}</Notice>}
    <form onSubmit={submit} noValidate>
      {register && <label>Nombre<Input icon={<UserRound size={18}/>} value={name} onChange={setName} autoComplete="name" placeholder="Tu nombre" maxLength={80}/></label>}
      <label>Correo electrónico<Input icon={<Mail size={18}/>} value={email} onChange={setEmail} type="email" autoComplete="email" placeholder="nombre@ejemplo.com" maxLength={254}/></label>
      {!reset && <><div className="password-heading"><label htmlFor="password">Contraseña</label>{!register && <Link to="/recuperar">¿La olvidaste?</Link>}</div><div className="input-wrap"><LockKeyhole size={18}/><input id="password" value={password} onChange={e => setPassword(e.target.value)} type={visible ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? "Mínimo 8 caracteres" : "Tu contraseña"} maxLength={128}/><button type="button" className="icon-button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></>}
      {register && <><label>Confirmar contraseña<Input icon={<LockKeyhole size={18}/>} value={confirm} onChange={setConfirm} type={visible ? "text" : "password"} autoComplete="new-password" placeholder="Repite tu contraseña" maxLength={128}/></label><label className="checkbox-label"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>Acepto que Visual Community guarde mi perfil y actividad de navegación para gestionar mi participación. <Link to="/privacidad">Conocer el uso de mis datos.</Link></span></label></>}
      <button className="button primary auth-submit" disabled={state.busy || !firebaseConfigured} type="submit">{state.busy ? "Un momento…" : register ? "Crear mi cuenta" : reset ? "Enviar instrucciones" : "Iniciar sesión"}<ArrowRight size={18}/></button>
    </form><p className="auth-switch">{register ? "¿Ya eres parte de la comunidad?" : reset ? "¿Recordaste tu contraseña?" : "¿Aún no tienes cuenta?"} <Link to={register || reset ? "/login" : "/registro"}>{register || reset ? "Inicia sesión" : "Crea una cuenta"}</Link></p><div className="auth-security"><ShieldCheck size={17}/><span>Tu cuenta está protegida con Firebase Authentication.</span></div></div><p className="auth-legal">Visual Community es una plataforma independiente.<br/>Los contenidos oficiales conservan su fuente original.</p></section></div>;
}
import type { ReactNode } from "react";
function Input({ icon, value, onChange, ...rest }: { icon: ReactNode; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; placeholder?: string; maxLength?: number }) {
  return <span className="input-wrap">{icon}<input {...rest} value={value} onChange={e => onChange(e.target.value)}/></span>;
}
