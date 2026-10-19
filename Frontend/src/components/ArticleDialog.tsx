import { useEffect, useRef } from "react";
import { X, BookOpen } from "lucide-react";
import type { EnergyArticle } from "../../../shared/models";
import { dateLabel, sourceNames, SourceLink } from "./UI";
import { interactionService } from "../services/interactionService";
export function ArticleDialog({ article, close }: { article: EnergyArticle | null; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!article) return;
    ref.current?.showModal();
    void interactionService.track({ eventType: article.type === "Resolución" || article.type === "Decreto" ? "VIEW_REGULATION" : "VIEW_ARTICLE", contentId: article.id, source: article.source });
    return () => ref.current?.close();
  }, [article?.id]);
  return <dialog ref={ref} className="content-dialog" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    {article && <><div className="dialog-header"><span className="icon-tile"><BookOpen/></span><button className="icon-button" aria-label="Cerrar detalle" onClick={close}><X/></button></div><p className="eyebrow">{article.type} · {article.source}</p><h2>{article.title}</h2><p>{article.description}</p><div className="source-note"><strong>{sourceNames[article.source]}</strong><span>{dateLabel(article.date)}</span><p>Este resumen facilita la consulta. El contenido completo y sus actualizaciones están en la fuente original.</p></div><SourceLink url={article.sourceUrl} source={article.source} contentId={article.id} className="button primary">Abrir recurso oficial</SourceLink></>}
  </dialog>;
}
