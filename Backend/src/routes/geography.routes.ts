import { Router, type Request, type Response } from "express";
import { geographyService, type GeographyService } from "../services/geography/geography.service";
import { GeographyError } from "../services/geography/http";
import { validateGeography } from "../services/geography/validation";
export function createGeographyRoutes(service: GeographyService = geographyService) {
  const router = Router();
  // Presupuesto independiente: explorar mapas no consume el cupo de búsqueda/chat existente.
  const requests = new Map<string, { count: number; until: number }>();
  router.use((req, res, next) => {
    const now = Date.now(); for (const [key, entry] of requests) if (entry.until <= now) requests.delete(key);
    const key = String(res.locals.user?.uid || req.ip); const entry = requests.get(key) || { count: 0, until: now + 60000 };
    if (++entry.count > 45 || requests.size >= 2000 && !requests.has(key)) { res.setHeader("Retry-After", "60"); res.status(429).json({ message: "Has realizado muchas consultas de mapas. Espera un minuto antes de continuar." }); return; }
    requests.set(key, entry); next();
  });
  function handler(kind: "context" | "features" | "wms") {
    return async (req: Request, res: Response) => {
      const controller = new AbortController();
      const closed = () => { if (!res.writableEnded) controller.abort(); };
      req.once("aborted", closed); res.once("close", closed);
      try {
        const input = validateGeography(req.query, kind === "wms");
        const value = await service[kind](input, controller.signal);
        if (!controller.signal.aborted) {
          if (kind === "wms") {
            const image = value as Awaited<ReturnType<GeographyService["wms"]>>;
            res.setHeader("X-Map-Bounds", image.bounds.join(",")); res.setHeader("Access-Control-Expose-Headers", "X-Map-Bounds");
            res.type("image/png").send(Buffer.from(image.bytes));
          }
          else res.json(value);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          // Solo categorías controladas y estado HTTP: nunca consultas, tokens ni errores originales.
          const diagnostic = error instanceof GeographyError ? error.diagnostic : undefined;
          if (diagnostic) console.warn(JSON.stringify({ service: "geography", ...diagnostic }));
          res.status(error instanceof GeographyError ? error.status : 503).json({ message: error instanceof GeographyError ? error.message : "El mapa no está disponible temporalmente. Puedes seguir consultando los resultados de búsqueda.", ...(diagnostic ? { diagnostic } : {}) });
        }
      } finally { req.removeListener("aborted", closed); res.removeListener("close", closed); }
    };
  }
  router.get("/context", handler("context")); router.get("/features", handler("features")); router.get("/wms", handler("wms"));
  return router;
}
export const geographyRoutes = createGeographyRoutes();
