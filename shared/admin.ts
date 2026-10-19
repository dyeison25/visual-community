import type { EventType, Interaction, UserMetrics } from "./models";
export interface AdminUser {
  uid: string; name: string; email: string | null; createdAt: string | null;
  lastSignInAt: string | null; role: "user" | "admin"; onboardingCompleted: boolean;
  topics: string[]; formats: string[]; totalInteractions: number;
}
export interface AdminUserDetail { user: AdminUser; metrics: UserMetrics; recent: Interaction[] }
export interface AdminUsersPage { users: AdminUser[]; total: number; offset: number; hasMore: boolean; calculatedAt: string }
export interface AdminOverview {
  totalUsers: number; totalInteractions: number; contentViews: number; logins: number;
  activeUsersLast7Days: number; calculatedAt: string;
  recent: Interaction[];
  eventTypes: { eventType: string; count: number }[];
  sampleSize: number; sampleDescription: string;
}
export const EVENT_LABELS: Record<EventType, string> = {
  REGISTER: "Registro de cuenta", LOGIN: "Inicio de sesión", LOGOUT: "Cierre de sesión",
  VIEW_DASHBOARD: "Visita al inicio", VIEW_ARTICLE: "Consulta de contenido",
  VIEW_REGULATION: "Consulta de normativa", VIEW_METRIC: "Consulta de indicador",
  CLICK_EXTERNAL_SOURCE: "Apertura de fuente oficial", VIEW_ENERGY_COMMUNITY: "Consulta de comunidad",
  UPDATE_PROFILE: "Actualización de perfil", COMPLETE_ONBOARDING: "Encuesta completada",
  SELECT_PREFERENCES: "Cambio de preferencias",
  VIEW_ENERGY_MAP:"Consulta del mapa", CLICK_ENERGY_COMMUNITY_MARKER:"Selección de comunidad en mapa", SEARCH:"Búsqueda", SEARCH_RESULT_CLICK:"Resultado de búsqueda", RECOMMENDATION_CLICK:"Recomendación abierta", CHAT_OPEN:"Apertura del asistente", CHAT_QUERY:"Consulta al asistente", CHAT_RESPONSE:"Respuesta del asistente", CHAT_SOURCE_CLICK:"Fuente del asistente",
};
