import type { UserProfile } from "./models";

// Identificadores estables: el texto visible puede cambiar sin perder las preferencias.
export const TOPIC_OPTIONS = [
  { id: "energy_communities", label: "Comunidades energéticas" },
  { id: "regulation", label: "Normativa y regulación energética" },
  { id: "generation", label: "Generación de energía" },
  { id: "demand", label: "Demanda de energía" },
  { id: "energy_market", label: "Precios y mercado energético" },
  { id: "renewable_energy", label: "Energías renovables" },
  { id: "energy_projects", label: "Proyectos energéticos" },
  { id: "sustainability", label: "Sostenibilidad y transición energética" },
  { id: "energy_news", label: "Noticias del sector energético" },
] as const;
export const FORMAT_OPTIONS = [
  { id: "news", label: "Noticias" }, { id: "statistics", label: "Indicadores y estadísticas" },
  { id: "regulation", label: "Normativa" }, { id: "communities", label: "Comunidades" },
  { id: "projects", label: "Proyectos" }, { id: "education", label: "Contenido educativo" },
] as const;
export function validatePreferences(topics: unknown, formats: unknown): string | null {
  if (!Array.isArray(topics) || !topics.length || topics.length > TOPIC_OPTIONS.length
    || new Set(topics).size !== topics.length || topics.some(id => !TOPIC_OPTIONS.some(item => item.id === id)))
    return "Selecciona al menos un tema de interés.";
  if (!Array.isArray(formats) || formats.length > FORMAT_OPTIONS.length
    || new Set(formats).size !== formats.length || formats.some(id => !FORMAT_OPTIONS.some(item => item.id === id)))
    return "Revisa los tipos de contenido seleccionados.";
  return null;
}
/** Recupera los intereses anteriores como sugerencias sin borrar ni reescribir el historial. */
export function profileTopics(profile: UserProfile | null): string[] {
  if (profile?.preferences.topics !== undefined) return profile.preferences.topics;
  const legacy: Record<string, string[]> = {
    "Energía solar": ["renewable_energy"], "Comunidades energéticas": ["energy_communities"],
    "Normativa": ["regulation"], "Datos del sector": ["generation", "demand", "energy_market"],
    "Consumo responsable": ["sustainability"],
  };
  return [...new Set((profile?.interests || []).flatMap(item => legacy[item] || []))];
}
export const topicLabel = (id: string) => TOPIC_OPTIONS.find(item => item.id === id)?.label || id;
export const formatLabel = (id: string) => FORMAT_OPTIONS.find(item => item.id === id)?.label || id;

/** Clasificación simple de consultas: permite guardar categorías sin conservar el texto libre. */
export function inferTopics(text:string):string[] {
  const words:Record<string,string[]>={energy_communities:["comunidad","comunidades"],regulation:["normativa","regulacion","resolucion","creg"],
    generation:["generacion","generar"],demand:["demanda","consumo"],energy_market:["precio","bolsa","mercado"],
    renewable_energy:["solar","renovable","eolica"],energy_projects:["proyecto"],sustainability:["sostenibilidad","transicion"],energy_news:["noticia"]};
  const clean=text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return Object.entries(words).filter(([,terms])=>terms.some(term=>clean.includes(term))).map(([key])=>key);
}
