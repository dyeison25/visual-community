import type { RequestHandler } from "express";
import { AuthService } from "../services/auth.service";
const service = new AuthService();
/**
 * Controla el acceso a una ruta privada del backend.
 * Lee el ID token del encabezado Authorization y pide a Firebase que lo verifique.
 * Guarda el usuario verificado en res.locals.user para las funciones siguientes.
 * Solo llama a next() para continuar si la sesión es válida; de lo contrario, devuelve 401.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ") || header.length > 10000) {
    res.status(401).json({ ok: false, message: "Inicia sesión para continuar." }); return;
  }
  try {
    res.locals.user = await service.verifySession(header.slice(7));
    next();
  } catch {
    res.status(401).json({ ok: false, message: "Tu sesión no es válida. Inicia sesión nuevamente." });
  }
};
