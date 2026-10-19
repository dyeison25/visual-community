import { AlertCircle, ArrowUpRight, RefreshCw, FileText, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { MINISTRY_COMMUNITIES_PAGE, publicMinistryUrl } from "../../../shared/officialSources";
import { resolveSourceUrl } from "../services/sourceService";
import type { EnergyArticle, Source } from "../../../shared/models";
import { interactionService } from "../services/interactionService";
export const sourceNames: Record<Source, string> = { MinEnergía: "Ministerio de Minas y Energía", CREG: "Comisión de Regulación de Energía y Gas", XM: "XM · Sinergox" };
export function dateLabel(value?: string | null) { return value ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(new Date(value.length === 10 ? value + "T12:00:00Z" : value)) : "Sin fecha publicada"; }
export function Loading({ label = "Consultando información oficial…" }: { label?: string }) { return <div className="loading-state" role="status"><span className="spinner"/><span>{label}</span></div>; }
export function Empty({ children }: { children: ReactNode }) { return <div className="empty-state"><FileText size={26}/><p>{children}</p></div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) { return <div className="message error" role="alert"><AlertCircle size={19}/><span>{message}</span>{retry && <button className="text-button" onClick={retry}><RefreshCw size={15}/>Reintentar</button>}</div>; }
export function Notice({ children, dismiss }: { children: ReactNode; dismiss?: () => void }) { return <div className="message notice" role="status"><AlertCircle size={18}/><span>{children}</span>{dismiss && <button className="icon-button" aria-label="Cerrar mensaje" onClick={dismiss}><X size={16}/></button>}</div>; }
export function SectionHeading({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) { return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{children}</div>; }
export function PageHeading({ title, description, children }: { title: string; description: string; children?: ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">VISUAL COMMUNITY / COLOMBIA</p><h1>{title}</h1><p>{description}</p></div>{children}</div>; }
export function SourceLink({ url, source, contentId, children = "Ver fuente original", className = "", additionalEvent, category }: { url: string; source: Source; contentId: string; children?: ReactNode; className?: string; additionalEvent?: "CHAT_SOURCE_CLICK"; category?: string }) {
  const [error,setError]=useState("");
  const target=source==="MinEnergía"?(publicMinistryUrl(url)?url:url?MINISTRY_COMMUNITIES_PAGE:""):url;
  function track(){void interactionService.track({eventType:"CLICK_EXTERNAL_SOURCE",contentId,source});if(additionalEvent)void interactionService.track({eventType:additionalEvent,contentId,source,metadata:category?{category}:{}});}
  let safe = false; try { const parsed = new URL(target); safe = parsed.protocol === "https:"; } catch { /* No renderizar enlaces inválidos. */ }
  if (!safe) return null;
  return <><a className={"source-link " + className} href={target} target="_blank" rel="noopener noreferrer" onClick={event=>{
    setError("");
    if(source!=="MinEnergía"){track();return;}
    event.preventDefault();
    const tab=window.open("about:blank","_blank");
    if(tab)tab.opener=null;
    void resolveSourceUrl(target,source).then(verified=>{
      if(tab&&!tab.closed){tab.location.replace(verified);track();}
      else setError("Permite abrir una pestaña para consultar la fuente oficial.");
    }).catch(()=>{tab?.close();setError("La fuente oficial no está disponible en este momento. Puedes consultar el detalle aquí.");});
  }}>{children}<ArrowUpRight size={16}/></a>{error&&<span className="muted small" role="alert">{error}</span>}</>;
}
export function ArticleCard({ article, onOpen }: { article: EnergyArticle; onOpen: (article: EnergyArticle) => void }) {
  return <article className="card article-card"><div className="article-top"><span className={"source-tag " + article.source.toLowerCase()}>{article.source === "MinEnergía" ? "MINENERGÍA" : article.source}</span><span className="muted small">{article.type}</span></div><button className="article-title" onClick={() => onOpen(article)}>{article.title}</button><p>{article.description}</p><div className="article-bottom"><span className="muted small">{article.date ? dateLabel(article.date) : "Recurso institucional"}</span><SourceLink url={article.sourceUrl} source={article.source} contentId={article.id}/></div></article>;
}
