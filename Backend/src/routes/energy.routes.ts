import { Router } from "express";
import { getXmMetrics } from "../services/xm/xm.service";
import { getCommunities } from "../services/minenergia/minenergia.service";
import { getMinistryArticles } from "../services/minenergia/articles";
import { cregService } from "../services/creg/creg.service";
import { getCommunityMap } from "../services/minenergia/map.service";
import { resolveMinistryUrl } from "../services/minenergia/public-links.service";
const router = Router();
router.get("/ministry-source", async (req,res) => {
  if(req.query.url!==undefined&&(typeof req.query.url!=="string"||req.query.url.length>2048)){res.status(400).json({message:"Enlace no válido."});return;}
  const url=await resolveMinistryUrl(req.query.url);
  res.json({url});
});
router.get("/map", async (_req, res) => res.json(await getCommunityMap()));
/**
 * GET /api/energy/metrics: pide al servicio de XM los tres indicadores.
 * La ruta recibe la petición; el servicio se encarga de consultar la fuente oficial.
 */
router.get("/metrics", async (_req, res) => res.json(await getXmMetrics()));
/**
 * GET /api/energy/communities: busca comunidades y entrega una página de resultados.
 * offset indica cuántos registros saltar y q contiene el texto de búsqueda.
 * Revisa ambos valores antes de enviarlos al servicio de MinEnergía.
 */
router.get("/communities", async (req, res) => {
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
  const search = req.query.q === undefined ? "" : req.query.q;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || typeof search !== "string" || search.length > 80) {
    res.status(400).json({ message: "Revisa los filtros de búsqueda." }); return;
  }
  res.json(await getCommunities(offset, search));
});
/**
 * GET /api/energy/articles: entrega la selección manual de recursos del Ministerio.
 * Estos artículos tienen enlaces oficiales, pero no se descargan de una API.
 */
router.get("/articles", (_req, res) => res.json(getMinistryArticles()));
/**
 * GET /api/energy/regulations: entrega el catálogo de resoluciones seleccionadas.
 * Actualmente se actualiza a mano; la consulta no llama a una API de la CREG.
 */
router.get("/regulations", async (_req, res) => res.json(await cregService.list()));
export default router;
