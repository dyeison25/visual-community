import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { rateLimit } from "../middleware/rate-limit.middleware";
import { touchActivity, type ActivityKind } from "../services/notifications/activity.service";

export const activityRoutes = Router();
activityRoutes.post("/", requireAuth, rateLimit, async (req, res) => {
  const kind: ActivityKind = req.body?.kind === "interaction" ? "interaction" : "session_resume";
  try { const result = await touchActivity(res.locals.user.uid, kind); res.json({ ok: true, touched: result.touched }); }
  catch { res.status(503).json({ message: "No pudimos actualizar tu actividad. Puedes continuar usando la plataforma." }); }
});
