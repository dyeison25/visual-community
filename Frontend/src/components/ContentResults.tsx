import { useState } from "react";
import { Link } from "react-router-dom";
import type { EnergyContent, Recommendation } from "../../../shared/discovery";
import { officialContentUrl } from "../../../shared/discovery";
import { topicLabel } from "../../../shared/preferences";
import { interactionService } from "../services/interactionService";
import { ArticleDialog } from "./ArticleDialog";
import { CommunityDialog } from "./CommunityDialog";
import { SourceLink,dateLabel } from "./UI";
export function ContentResults({items,origin}:{items:Recommendation[];origin:"search"|"recommendation"}){
  const [selected,setSelected]=useState<EnergyContent|null>(null);
  function open(content:EnergyContent){
    void interactionService.track({eventType:origin==="search"?"SEARCH_RESULT_CLICK":"RECOMMENDATION_CLICK",contentId:content.contentId,source:content.source,metadata:{category:content.category}});
    setSelected(content);
  }
  return <><div className="discovery-grid">{items.map(({content,reason})=><article className="card discovery-card" key={content.objectID}>
    <div className="article-top"><span className="source-tag">{content.source}</span><span className="muted small">{topicLabel(content.category)}</span></div>
    {content.kind==="metric"?<Link className="article-title" to={"/datos?metrica="+encodeURIComponent(content.contentId)} onClick={()=>open(content)}>{content.title}</Link>:<button className="article-title" onClick={()=>open(content)}>{content.title}</button>}
    <p>{content.description}</p>{reason&&<p className="recommendation-reason">{reason}</p>}
    <div className="article-bottom">{content.publishedAt&&<span className="muted small">{dateLabel(content.publishedAt)}</span>}
    {officialContentUrl(content.sourceUrl)&&<SourceLink url={content.sourceUrl} source={content.source} contentId={content.contentId}>Consultar fuente oficial</SourceLink>}</div>
  </article>)}</div>
  <ArticleDialog article={selected?.article||null} close={()=>setSelected(null)}/>
  <CommunityDialog community={selected?.community||null} close={()=>setSelected(null)}/></>;
}
