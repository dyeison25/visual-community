export type Source = "MinEnergía" | "CREG" | "XM";
export interface EnergyArticle {
  id: string; title: string; description: string; date: string | null;
  source: Source; sourceUrl: string; type: "Guía" | "Resolución" | "Decreto" | "Información";
  topics: string[];
}
export interface EnergyCommunity {
  id: string; name: string; department: string; municipality: string; status: string | null;
  latitude: number | null; longitude: number | null; area?: string | null; operator?: string | null; executor?: string | null; source: "MinEnergía"; sourceUrl: string;
}
export interface MetricPoint { date: string; value: number }
export interface EnergyMetric {
  id: string; name: string; value: number | null; unit: string; date: string | null;
  source: "XM"; sourceUrl: string; series: MetricPoint[];
  aggregation: "Suma diaria" | "Promedio horario diario"; description: string;
  status: "ok" | "empty" | "unavailable"; message?: string;
}
export interface SourceResult<T> {
  data: T; source: Source; sourceUrl: string;
  status: "ok" | "empty" | "unavailable" | "partial" | "curated";
  fetchedAt: string; message?: string;
}
export interface CommunityData { communities: EnergyCommunity[]; total: number | null; hasMore: boolean; offset: number }
export const EVENT_TYPES = ["REGISTER", "LOGIN", "LOGOUT", "VIEW_ARTICLE", "VIEW_REGULATION", "VIEW_METRIC", "CLICK_EXTERNAL_SOURCE", "VIEW_ENERGY_COMMUNITY", "VIEW_DASHBOARD", "UPDATE_PROFILE", "COMPLETE_ONBOARDING", "SELECT_PREFERENCES", "VIEW_ENERGY_MAP", "CLICK_ENERGY_COMMUNITY_MARKER", "SEARCH", "SEARCH_RESULT_CLICK", "RECOMMENDATION_CLICK", "CHAT_OPEN", "CHAT_QUERY", "CHAT_RESPONSE", "CHAT_SOURCE_CLICK"] as const;
export type EventType = typeof EVENT_TYPES[number];
export interface InteractionInput { eventType: EventType; contentId?: string; source?: Source | "Visual Community"; metadata?: { path?: string; section?: string; category?: string; queryLength?: number } }
export interface Interaction extends InteractionInput { id: string; userId: string; timestamp: string | null }
export interface UserProfile {
  userId: string; name: string; interests: string[];
  preferences: { compactMetrics: boolean; topics?: string[]; formats?: string[] };
  role?: "user" | "admin"; onboardingCompleted?: boolean;
  /** Preferencia explícita de recordatorios. Las fechas las escribe únicamente el backend. */
  emailNotifications?: {
    enabled: boolean;
    consentedAt?: unknown | null;
    revokedAt?: unknown | null;
    updatedAt?: unknown;
  };
  createdAt?: unknown; updatedAt?: unknown;
}

export interface UserMetrics { userId: string; totalInteractions: number; contentViews: number; logins: number; calculatedAt: string }
