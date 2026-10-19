import { Router, type Request, type Response } from "express";
import { getAdminOverview, getAdminUsers, getAdminUser } from "../services/admin/admin.service";
const router = Router();
/** Devuelve errores comprensibles sin filtrar detalles de Firebase ni datos de otras peticiones. */
function handle(load: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const data = await Promise.race([load(req), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 25000);
      })]);
      res.json({ data, ok: true });
    } catch (error) {
      const notFound = typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found";
      res.status(notFound ? 404 : 503).json({ message: notFound ? "No encontramos esta cuenta." : "La información administrativa no está disponible en este momento." });
    } finally { if (timer) clearTimeout(timer); }
  };
}
router.get("/summary", handle(() => getAdminOverview()));
router.get("/users", (req, res, next) => {
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) { res.status(400).json({ message: "Revisa la página solicitada." }); return; }
  next();
}, handle(req => getAdminUsers(Number(req.query.offset || 0))));
router.get("/users/:uid", (req, res, next) => {
  const uid = req.params.uid;
  if (typeof uid !== "string" || !/^[a-zA-Z0-9:_-]{1,128}$/.test(uid)) { res.status(400).json({ message: "La cuenta solicitada no es válida." }); return; }
  next();
}, handle(req => getAdminUser(String(req.params.uid))));
export default router;
