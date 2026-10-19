import { Zap } from "lucide-react";
export function Brand({ light = false }: { light?: boolean }) {
  return <div className={"brand " + (light ? "brand-light" : "")}><span className="brand-symbol"><Zap size={23} fill="currentColor" strokeWidth={1.5}/></span><span>Visual <strong>Community</strong><small>ENERGÍA QUE NOS CONECTA</small></span></div>;
}
