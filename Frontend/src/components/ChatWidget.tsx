import { useEffect,useRef,useState } from "react";
import { MessageCircle,X,Send } from "lucide-react";
import { discoveryService } from "../services/discoveryService";
import { interactionService } from "../services/interactionService";
import type { ChatTurn,EnergyContent } from "../../../shared/discovery";
import { officialContentUrl } from "../../../shared/discovery";
import { inferTopics } from "../../../shared/preferences";
import { SourceLink } from "./UI";
type Message=ChatTurn&{sources?:EnergyContent[]};
export function ChatWidget(){
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(""),[messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const logRef=useRef<HTMLDivElement>(null);
  const ref=useRef<HTMLDialogElement>(null),controller=useRef<AbortController|null>(null),inFlight=useRef(false);
  useEffect(()=>{if(open)ref.current?.showModal();else ref.current?.close();},[open]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{const log=logRef.current;if(log)log.scrollTo({top:log.scrollHeight,behavior:"smooth"});},[messages,busy,error,open]);
  async function send(){
    if(inFlight.current||!draft.trim())return;
    const question=draft.trim();const history=messages.slice(-4).map(({role,content})=>({role,content:content.slice(0,1200)}));
    inFlight.current=true;setBusy(true);setError("");controller.current=new AbortController();
    void interactionService.track({eventType:"CHAT_QUERY",metadata:{queryLength:question.length,...(inferTopics(question)[0]?{category:inferTopics(question)[0]}:{})}});
    try{
      const result=await discoveryService.chat(question,history,controller.current.signal);
      setMessages(previous=>[...previous,{role:"user",content:question},{role:"assistant",content:result.answer,sources:result.sources}].slice(-10) as Message[]);
      setDraft("");
      void interactionService.track({eventType:"CHAT_RESPONSE",metadata:result.category?{category:result.category}:{}});
    }catch(e){if(!controller.current.signal.aborted)setError(e instanceof Error?e.message:"El asistente no está disponible temporalmente.");}
    finally{inFlight.current=false;setBusy(false);}
  }
  return <><button className="chat-launcher" onClick={()=>{setOpen(true);void interactionService.track({eventType:"CHAT_OPEN"});}} aria-label="Abrir asistente"><MessageCircle size={20}/><span>Asistente</span></button>
    <dialog ref={ref} className="chat-dialog" aria-labelledby="chat-title" onCancel={()=>setOpen(false)}>
      <header><div><p className="eyebrow">VISUAL COMMUNITY</p><h2 id="chat-title">Tu asistente de energía</h2></div><button className="icon-button" aria-label="Cerrar asistente" onClick={()=>setOpen(false)}><X/></button></header>
      <p className="muted small">Consulta fuentes de la plataforma. Evita datos personales. Al enviar, tu pregunta y hasta cuatro mensajes se procesan con Google Gemini. En su nivel gratuito, Google puede usarlos para mejorar sus productos. No guardamos aquí la conversación de forma permanente.</p>
      <div ref={logRef} className="chat-messages" role="log" aria-live="polite">
        {!messages.length&&<p>¿Qué quieres conocer sobre las comunidades energéticas o los datos del sector?</p>}
        {messages.map((message,i)=><article key={i} className={"chat-message "+message.role}><strong>{message.role==="user"?"Tú":"Visual Community"}</strong><p>{message.content}</p>
          {!!message.sources?.length&&<div className="chat-sources"><strong>Fuentes consultadas</strong>{message.sources.filter(source=>officialContentUrl(source.sourceUrl)).map((source,index)=><SourceLink key={source.objectID} url={source.sourceUrl} source={source.source} contentId={source.contentId} additionalEvent="CHAT_SOURCE_CLICK" category={source.category}>[{index+1}] {source.source} · {source.title}</SourceLink>)}</div>}
        </article>)}
        {busy&&<p role="status">Consultando las fuentes…</p>}
      </div>
      {error&&<p className="message error" role="alert">{error}</p>}
      <form onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="chat-question">Tu pregunta</label><textarea id="chat-question" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={1200} rows={3} disabled={busy} placeholder="¿Qué es una comunidad energética?"/>
        <div className="chat-actions"><button type="button" className="text-button" disabled={busy} onClick={()=>{setMessages([]);setError("");}}>Nueva conversación</button><span className="muted small">{draft.length}/1200</span><button type="submit" className="button primary" disabled={busy||!draft.trim()}><Send size={16}/>Enviar</button></div></form>
    </dialog></>;
}
