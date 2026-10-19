import { useCallback, useEffect, useState } from "react";
/**
 * Ayuda a las pantallas a cargar información con el mismo manejo de espera y errores.
 * Ejecuta loader y entrega data, loading, error y refresh para mostrar datos o reintentar.
 * Al salir de la vista, señala la cancelación e ignora respuestas que lleguen tarde.
 */
export function useResource<T>(loader: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError(""); setData(null);
    loader(controller.signal).then(result => { if (active) setData(result); })
      .catch(error => { if (active) setError(error instanceof Error && error.name !== "TimeoutError" && error.name !== "AbortError" ? error.message : "La consulta tardó demasiado. Intenta de nuevo."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [loader, version]);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  return { data, loading, error, refresh };
}
