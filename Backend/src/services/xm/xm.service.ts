import type { EnergyMetric, MetricPoint, SourceResult } from "../../../../shared/models";
import { cached, fetchJson, officialBase, record, type Fetcher } from "../external/http";
export const XM_DEFINITIONS = [
  { id: "Gene", name: "Generación real", unit: "GWh", aggregation: "Suma diaria", description: "Energía neta generada en el Sistema Interconectado Nacional." },
  { id: "DemaReal", name: "Demanda de energía", unit: "GWh", aggregation: "Suma diaria", description: "Demanda real del SIN; no incluye alumbrado público." },
  { id: "PrecBolsNaci", name: "Precio de bolsa", unit: "COP/kWh", aggregation: "Promedio horario diario", description: "Promedio aritmético de 24 precios horarios. No es la tarifa de tu factura." },
] as const;
/**
 * Convierte la respuesta horaria de XM en valores diarios listos para mostrar.
 * Recibe el JSON y el identificador del indicador; devuelve fechas y valores ordenados.
 * Solo usa días con las 24 horas completas: suma energía y pasa de kWh a GWh,
 * o calcula el promedio de los 24 precios en COP/kWh.
 * Omite los días incompletos y rechaza respuestas con una estructura inesperada.
 */
export function parseXm(data: unknown, id: string): MetricPoint[] {
  const root = record(data);
  if (record(root.Metric).Id !== id || !Array.isArray(root.Items)) throw new Error("Métrica inesperada");
  const dates = new Set<string>();
  return root.Items.flatMap((item: unknown) => {
    const row = record(item);
    if (typeof row.Date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.Date) || !Array.isArray(row.HourlyEntities)) throw new Error("Serie inesperada");
    const systems = row.HourlyEntities.map(record).filter(entity => entity.Id === "Sistema");
    if (systems.length !== 1) throw new Error("Desagregación inesperada");
    const values = record(systems[0]!.Values);
    const hours = Array.from({ length: 24 }, (_, i) => values["Hour" + String(i + 1).padStart(2, "0")]);
    // Nunca convertir null, cadena vacía u horas faltantes en cero.
    if (hours.some(v => (typeof v !== "string" && typeof v !== "number") || String(v).trim() === "" || !Number.isFinite(Number(v)))) return [];
    if (dates.has(row.Date)) throw new Error("Fecha duplicada");
    dates.add(row.Date);
    const sum = hours.reduce<number>((total, value) => total + Number(value), 0);
    return [{ date: row.Date, value: id === "PrecBolsNaci" ? sum / 24 : sum / 1e6 }];
  }).sort((a, b) => a.date.localeCompare(b.date));
}
/**
 * Calcula el rango de consulta: los 14 días anteriores a hoy, con fecha de Colombia.
 * Excluye el día actual para no presentar un día en curso como si estuviera completo.
 */
export function xmWindow(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const end = new Date(today + "T12:00:00Z"); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 13);
  return { StartDate: start.toISOString().slice(0, 10), EndDate: end.toISOString().slice(0, 10) };
}
/**
 * Consulta la API oficial de XM mediante POST /hourly.
 * Pide generación, demanda y precio de bolsa; entrega series y el último valor disponible.
 * Reutiliza las consultas durante 5 minutos para reducir llamadas repetidas.
 * Cada indicador maneja su propio fallo, por lo que los demás pueden seguir mostrándose.
 * fetcher permite sustituir la petición en pruebas; en uso normal se hace una llamada real.
 */
export async function getXmMetrics(fetcher?: Fetcher): Promise<SourceResult<EnergyMetric[]>> {
  const sourceUrl = "https://sinergox.xm.com.co/";
  const base = officialBase(process.env.XM_API_URL || "https://servapibi.xm.com.co", "servapibi.xm.com.co");
  const window = xmWindow();
  const data = await Promise.all(XM_DEFINITIONS.map(async definition => {
    try {
      const load = async () => parseXm(await fetchJson(base + "/hourly", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ MetricId: definition.id, Entity: "Sistema", ...window }) }, fetcher), definition.id);
      const series = await (fetcher ? load() : cached("xm:" + definition.id + ":" + window.EndDate, load));
      const last = series.at(-1);
      return { ...definition, source: "XM" as const, sourceUrl, series, value: last?.value ?? null, date: last?.date ?? null, status: last ? "ok" as const : "empty" as const, ...(!last ? { message: "XM aún no publica días completos en el período consultado." } : {}) };
    } catch {
      return { ...definition, source: "XM" as const, sourceUrl, series: [], value: null, date: null, status: "unavailable" as const, message: "No pudimos consultar esta métrica de XM. Intenta nuevamente." };
    }
  }));
  const ok = data.filter(metric => metric.status === "ok").length;
  return { source: "XM", sourceUrl, data, status: ok === 3 ? "ok" : ok ? "partial" : data.every(m => m.status === "empty") ? "empty" : "unavailable", fetchedAt: new Date().toISOString(), message: "Últimos días completos publicados por XM. La fecha de cada indicador puede ser diferente; los datos tienen rezago de publicación." };
}
