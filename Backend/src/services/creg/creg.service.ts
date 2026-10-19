import type { EnergyArticle, SourceResult } from "../../../../shared/models";
export interface RegulationProvider { list(): Promise<SourceResult<EnergyArticle[]>> }
const sourceUrl = "https://gestornormativo.creg.gov.co/gestor/";
const regulations: EnergyArticle[] = [
  { id: "creg-101-087-2025", title: "Resolución CREG 101 087 de 2025", date: "2025-10-30", type: "Resolución", source: "CREG", sourceUrl: "https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_creg_101-87_2025.htm", description: "Ajustes sobre la transición de precios y disposiciones relacionadas con generación colectiva y excedentes.", topics: ["Normativa", "Comunidades energéticas"] },
  { id: "creg-101-072-2025", title: "Resolución CREG 101 072 de 2025", date: "2025-04-06", type: "Resolución", source: "CREG", sourceUrl: "https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_creg_101-72_2025.htm", description: "Marco regulatorio para incorporar las comunidades energéticas al sistema energético nacional.", topics: ["Normativa", "Comunidades energéticas"] },
  { id: "creg-174-2021", title: "Resolución CREG 174 de 2021", date: "2021-10-07", type: "Resolución", source: "CREG", sourceUrl: "https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_creg_0174_2021.htm", description: "Reglas de autogeneración a pequeña escala y generación distribuida en el SIN. Consulta las modificaciones en el texto oficial.", topics: ["Normativa", "Energía solar"] },
];
// No se verificó una API pública documentada de resoluciones. Este proveedor
// devuelve un catálogo editorial explícito; no hace scraping ni simula peticiones.
export const cregService: RegulationProvider = {
  /**
   * Devuelve las resoluciones del catálogo local, sus enlaces oficiales y la fecha de revisión.
   * No descarga documentos ni consulta una API: no se identificó una adecuada al implementar.
   * RegulationProvider permite agregar otro proveedor después sin cambiar las pantallas.
   */
  async list() { return { data: regulations, source: "CREG", sourceUrl, status: "curated", fetchedAt: "2026-09-07T00:00:00Z",
    message: "Catálogo de actualización manual, revisado el 7 de septiembre de 2026. No se identificó una API pública documentada de resoluciones de CREG. Verifica modificaciones y vigencia en Alejandría." }; },
};
