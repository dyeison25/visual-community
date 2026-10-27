import { collection, doc, setDoc, serverTimestamp, query, orderBy, limit, getDocs } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { Interaction, InteractionInput } from "../../../shared/models";
import { deadline } from "./errors";
import { activityService } from "./activityService";
type SyncStatus = "ready" | "pending" | "error";
let status: SyncStatus = "ready";
const listeners = new Set<() => void>();
let pending = 0;
let failures = 0;
function publish() { status = failures ? "error" : pending ? "pending" : "ready"; listeners.forEach(fn => fn()); }
export const interactionService = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getStatus() { return status; },
  /**
   * Intenta guardar una acción en profiles/{uid}/interactions con la hora de Firestore.
   * Obtiene el uid de la sesión, no de los datos que envíe una pantalla.
   * Devuelve true si confirma el guardado en el plazo de espera; false si no puede confirmarlo.
   * A los 1,8 segundos deja de esperar, pero la escritura puede completarse después.
   * No garantiza guardar el evento si se cierra el navegador antes de sincronizar.
   */
  async track(input: InteractionInput): Promise<boolean> {
    const user = auth?.currentUser;
    if (!user || !db) return false;
    if (input.eventType !== "LOGOUT") void activityService.touch("interaction");
    const metadata: NonNullable<InteractionInput["metadata"]> = {};
    // Solo rutas internas, sin querystrings, correos, IP, credenciales ni huellas del dispositivo.
    if (input.metadata?.path) metadata.path = input.metadata.path.split("?")[0].slice(0, 100);
    if (input.metadata?.section) metadata.section = input.metadata.section.slice(0, 60);
    if (input.metadata?.category) metadata.category = input.metadata.category.slice(0, 40);
    if (Number.isInteger(input.metadata?.queryLength)) metadata.queryLength = Math.min(1200, Math.max(0,input.metadata!.queryLength!));
    const event = {
      userId: user.uid, eventType: input.eventType, timestamp: serverTimestamp(),
      contentId: (input.contentId || "").slice(0, 120), source: input.source || "Visual Community", metadata,
    };
    pending++; publish();
    const write = setDoc(doc(collection(db, "profiles", user.uid, "interactions")), event)
      .then(() => { pending--; publish(); return true; })
      .catch(() => { pending--; failures++; publish(); return false; });
    try { return await deadline(write, 1800); }
    catch { return false; } // La escritura conserva su promesa; no se duplica al vencer el plazo.
  },
  /**
   * Lector heredado: las reglas ahora exigen admin incluso para la actividad propia.
   * Mi perfil no lo utiliza; el panel consulta adminService.user y el backend verifica el rol.
   * Lee las 20 interacciones más recientes del usuario autenticado.
   * Las ordena por fecha, desde la más nueva, y prepara las fechas para mostrarlas en el historial.
   */
  async recent(userId: string): Promise<Interaction[]> {
    if (!db || auth?.currentUser?.uid !== userId) throw new Error("Sesión requerida");
    const snapshot = await deadline(getDocs(query(collection(db, "profiles", userId, "interactions"), orderBy("timestamp", "desc"), limit(20))));
    return snapshot.docs.map(item => {
      const data = item.data();
      return { ...data, id: item.id, timestamp: data.timestamp?.toDate?.().toISOString() ?? null } as Interaction;
    });
  },
  reset() { failures = 0; publish(); },
};
