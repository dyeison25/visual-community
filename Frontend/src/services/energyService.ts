import type { CommunityData, EnergyCommunity, EnergyArticle, EnergyMetric, SourceResult } from "../../../shared/models";
import { apiGet } from "./api";
/**
 * Reúne las consultas de energía que usan las pantallas.
 * Todas llaman a nuestro backend; allí se decide cómo obtener cada fuente oficial.
 */
export const energyService = {
  map: (signal?: AbortSignal) => apiGet<SourceResult<EnergyCommunity[]>>("/energy/map", signal),
  /**
   * Pide las series y los valores recientes de generación, demanda y precio de XM.
   */
  metrics: (signal?: AbortSignal) => apiGet<SourceResult<EnergyMetric[]>>("/energy/metrics", signal),
  /**
   * Pide una página de comunidades y envía el texto de búsqueda como parámetro.
   */
  communities: (offset = 0, search = "", signal?: AbortSignal) => apiGet<SourceResult<CommunityData>>("/energy/communities?" + new URLSearchParams({ offset: String(offset), q: search }), signal),
  /**
   * Pide la selección manual de recursos institucionales de MinEnergía.
   */
  articles: (signal?: AbortSignal) => apiGet<SourceResult<EnergyArticle[]>>("/energy/articles", signal),
  /**
   * Pide el catálogo manual de normativa de la CREG.
   */
  regulations: (signal?: AbortSignal) => apiGet<SourceResult<EnergyArticle[]>>("/energy/regulations", signal),
};
