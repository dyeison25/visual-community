import { auth } from "../config/firebase";

let lastTouch = 0; let lastAttempt = 0; let pending = false; let userId = "";
const MINIMUM_INTERVAL = 15 * 60_000;
/** Actividad de retorno/interacción, no analítica de cada clic. El backend conserva el ciclo estable. */
export const activityService = {
  reset(uid = "") { if (userId === uid) return; userId = uid; lastTouch = 0; lastAttempt = 0; pending = false; },
  async touch(kind: "session_resume" | "interaction") {
    const current = auth?.currentUser; const now = Date.now();
    if (!current || pending || (current.uid === userId && (now - lastTouch < MINIMUM_INTERVAL || now - lastAttempt < 60_000))) return;
    userId = current.uid; pending = true; lastAttempt = now;
    try {
      const response = await fetch((import.meta.env.VITE_API_BASE_URL || "/api") + "/activity", {
        method: "POST", headers: { Authorization: "Bearer " + await current.getIdToken(), "Content-Type": "application/json" },
        body: JSON.stringify({ kind }), signal: AbortSignal.timeout(12_000),
      });
      if (response.ok && userId === current.uid) lastTouch = now;
    } catch { /* El usuario puede seguir navegando si no se registra este toque. */ }
    finally { if (userId === current.uid) pending = false; }
  },
};
