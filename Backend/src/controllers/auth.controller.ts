import type { Request, Response } from "express";
export class AuthController {
  /**
   * Devuelve los datos de la sesión que requireAuth ya comprobó.
   */
  session = (_req: Request, res: Response) => res.json({ ok: true, user: res.locals.user });
  /**
   * Responde 410 (ruta retirada) al recibir los antiguos intentos de acceso.
   * Indica que las credenciales ahora se gestionan con Firebase en la aplicación.
   */
  clientAuth = (_req: Request, res: Response) => res.status(410).json({
    ok: false, message: "Usa el registro, inicio y cierre de sesión de la aplicación con Firebase Authentication.",
  });
}
