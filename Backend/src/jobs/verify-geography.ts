/** Diagnóstico manual de solo lectura. No inicia Express, Firebase, Algolia ni jobs de correo. */
import { createGeographyService } from "../services/geography/geography.service";
import { GeographyError } from "../services/geography/http";
import type { MapLayerId } from "../../../shared/geography";
const service = createGeographyService({ recordLimit: 2 });
const probes: [MapLayerId, string][] = [["communities", "Comunidades energéticas"], ["solar", "Radiación solar"], ["wind", "Potencial eólico"],
  ["generation", "Proyectos de generación eléctrica"], ["substations", "Subestaciones"], ["transmission", "Líneas de transmisión"], ["connection", "Capacidad asignada"]];
for (const [layer, q] of probes) {
  try {
    const context = await service.context({ q });
    const data = await service.features({ q, layer });
    const wmsBytes = context.layer?.supportsWms ? (await service.wms({ q, layer, display: "wms", bbox: context.coverageBounds })).bytes.length : undefined;
    console.log(JSON.stringify({ check: "geography-read-only", layer, status: context.status, records: data.features.length, discarded: data.discarded, sampleLimited: data.truncated, wmsBytes }));
    if (context.status !== "ready" || !data.features.length) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ check: "geography-read-only", layer, status: "unavailable", code: error instanceof GeographyError ? error.status : "unexpected" })); process.exitCode = 1;
  }
}
try {
  const context = await service.context({ q: "Subestaciones en Medellín" });
  console.log(JSON.stringify({ check: "official-place", municipalityCode: context.place?.municipalityCode, officialBounds: !!context.bounds }));
  if (context.place?.municipalityCode !== "05001" || !context.bounds) process.exitCode = 1;
} catch { console.error(JSON.stringify({ check: "official-place", status: "unavailable" })); process.exitCode = 1; }
