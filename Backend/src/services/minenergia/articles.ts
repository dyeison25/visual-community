import type { EnergyArticle, SourceResult } from "../../../../shared/models";
import { MINENERGIA_PAGE } from "./minenergia.service";
export const ministryArticles: EnergyArticle[] = [
  { id: "min-comunidades", title: "¿Qué son las comunidades energéticas?", description: "Una comunidad energética reúne personas u organizaciones para atender necesidades energéticas colectivas. La estrategia del Ministerio promueve la autogeneración compartida, la eficiencia energética y la generación descentralizada; contempla aprovechar excedentes según las reglas aplicables. La publicación explica el propósito de la estrategia, no una convocatoria actualmente abierta.", date: null, source: "MinEnergía", sourceUrl: MINENERGIA_PAGE, type: "Información", topics: ["Comunidades energéticas"] },
  { id: "min-manual", title: "Herramientas para construir en comunidad", description: "El Manual de gestión de comunidades energéticas de 2025 explica etapas de viabilidad, estructuración, implementación y sostenibilidad, con anexos para sistemas fotovoltaicos.", date: null, source: "MinEnergía", sourceUrl: "https://www.minenergia.gov.co/documents/14860/Manual-Gestion-Comunidades-Energeticas-2025.pdf", type: "Guía", topics: ["Energía solar", "Comunidades energéticas"] },
  { id: "min-registro-2026", title: "Consulta el proceso de registro RCE", description: "El Manual de gestión de 2025 incluye procedimientos de registro inicial y registro de comunidades en operación. Consulta el documento original y la normativa aplicable; este resumen no confirma trámites o convocatorias vigentes.", date: null, source: "MinEnergía", sourceUrl: "https://www.minenergia.gov.co/documents/14860/Manual-Gestion-Comunidades-Energeticas-2025.pdf", type: "Información", topics: ["Normativa"] },
];
/**
 * Devuelve recursos oficiales elegidos manualmente, con su enlace y fecha de revisión.
 * El estado curated significa selección editorial; esta función no hace peticiones externas.
 * Las fechas de publicación desconocidas permanecen en null para no inventarlas.
 */
export function getMinistryArticles(): SourceResult<EnergyArticle[]> {
  return { data: ministryArticles, source: "MinEnergía", sourceUrl: MINENERGIA_PAGE, status: "curated", fetchedAt: "2026-09-21T00:00:00Z", message: "Selección editorial de recursos oficiales revisada el 21 de septiembre de 2026. No es un feed de noticias." };
}
