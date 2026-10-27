import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { rateLimit, publicRateLimit } from "../middleware/rate-limit.middleware";
import { setEmailConsent } from "../services/notifications/consent.service";
import { isOpaqueToken, unsubscribeWithToken } from "../services/notifications/unsubscribe.service";

export const notificationRoutes = Router();
notificationRoutes.post("/consent", requireAuth, rateLimit, async (req, res) => {
  if (typeof req.body?.enabled !== "boolean" || Object.keys(req.body).some(key => !["enabled", "origin"].includes(key))) { res.status(400).json({ message: "La preferencia de notificaciones no es válida." }); return; }
  try { await setEmailConsent(res.locals.user.uid, req.body.enabled, req.body.origin === "onboarding" ? "onboarding" : "profile"); res.json({ ok: true, enabled: req.body.enabled }); }
  catch { res.status(503).json({ message: "No pudimos actualizar tus notificaciones. Intenta nuevamente." }); }
});
// Abrir un correo nunca invoca este POST: la interfaz pública exige confirmación explícita.
notificationRoutes.post("/unsubscribe", publicRateLimit, async (req, res) => {
  try {
    const complete = req.body?.confirm === true && isOpaqueToken(req.body?.token) && Object.keys(req.body).every(key => ["token", "confirm"].includes(key)) && await unsubscribeWithToken(req.body.token);
    res.status(complete ? 200 : 400).json({ ok: complete, message: complete ? "Ya no recibirás recordatorios por correo." : "El enlace no es válido, ya fue usado o expiró." });
  } catch { res.status(503).json({ ok: false, message: "No pudimos procesar la baja. Intenta nuevamente más tarde." }); }
});
