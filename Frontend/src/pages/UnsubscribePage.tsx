import { useEffect, useState } from "react";
import { BellOff, CheckCircle2, ShieldCheck } from "lucide-react";
import { Brand } from "../components/Brand";
import { notificationService } from "../services/notificationService";

/** Ruta pública: abrir el enlace no modifica nada; el usuario debe confirmar la baja. */
export function UnsubscribePage() {
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<"idle" | "done" | "error">("idle");
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("t") || "");
  useEffect(() => { window.history.replaceState(null, "", window.location.pathname); }, []);
  async function confirm() {
    if (!token) { setResult("error"); return; }
    setBusy(true);
    try { await notificationService.unsubscribe(token); setResult("done"); window.history.replaceState(null, "", window.location.pathname); }
    catch { setResult("error"); }
    finally { setBusy(false); }
  }
  return <main className="public-notification-page"><div className="public-notification-card card"><Brand/>
    {result === "done" ? <><CheckCircle2 className="public-notification-icon" size={36}/><h1>Recordatorios desactivados</h1><p>No recibirás más correos de recordatorio de Visual Community. Puedes activarlos nuevamente desde tu perfil cuando inicies sesión.</p></> : <><BellOff className="public-notification-icon" size={36}/><h1>¿Quieres dejar de recibir recordatorios?</h1><p>Esta acción desactivará únicamente los correos de recordatorio asociados a este enlace. No elimina tu cuenta ni modifica otras preferencias.</p>
      {result === "error" && <p className="form-error">El enlace no es válido, ya fue utilizado o expiró. Puedes gestionar esta preferencia desde Mi perfil al iniciar sesión.</p>}
      <button className="button primary" disabled={busy || !token} onClick={() => void confirm()}>{busy ? "Confirmando…" : "Sí, dejar de recibir recordatorios"}</button></>}
    <p className="muted small"><ShieldCheck size={15}/> La baja requiere tu confirmación; abrir el correo no la realiza automáticamente.</p>
  </div></main>;
}
