import { Router } from "express";
import { calculateUserMetrics } from "../services/user-metrics.service";
const router = Router();
/**
 * GET /api/profile/metrics: ruta de compatibilidad, ahora exclusiva de administradores.
 * Devuelve sus propios contadores; el panel consulta /api/admin para el resumen y otras cuentas.
 * El uid viene de la sesión que el backend ya verificó, no de un formulario.
 * Si el cálculo falla o supera 10 segundos, responde con un mensaje de espera.
 * Ese límite deja de esperar la respuesta, pero no cancela el cálculo en Firestore.
 */
router.get("/metrics", async (_req, res) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const data = await Promise.race([
      calculateUserMetrics(String(res.locals.user.uid)),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 10000); }),
    ]);
    res.json({ data, ok: true });
  } catch {
    res.status(503).json({ message: "Tus estadísticas no están disponibles en este momento." });
  } finally { if (timer) clearTimeout(timer); }
});
export default router;
