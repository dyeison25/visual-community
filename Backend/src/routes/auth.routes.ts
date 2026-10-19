import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
const router = Router();
const controller = new AuthController();
/**
 * GET /api/auth/me: permite consultar quién tiene la sesión activa.
 * requireAuth comprueba la sesión antes de que el controlador devuelva sus datos.
 * El registro y el inicio de sesión se realizan con Firebase desde el frontend.
 */
router.get("/me", requireAuth, controller.session);
// Se retiran explícitamente los flujos anteriores que no verificaban contraseñas.
router.post(["/register", "/login", "/logout"], controller.clientAuth);
export default router;
