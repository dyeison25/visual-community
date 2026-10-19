import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Users, Scale, ChartNoAxesCombined, Leaf } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useResource } from "../hooks/useResource";
import { energyService } from "../services/energyService";
import { interactionService } from "../services/interactionService";
import { EnergyIllustration } from "../components/EnergyIllustration";
import { ArticleCard, ErrorState, Loading, PageHeading, SectionHeading } from "../components/UI";
import { MetricCards } from "../components/Metrics";
import { ArticleDialog } from "../components/ArticleDialog";
import type { EnergyArticle } from "../../../shared/models";
import { Recommendations } from "../components/Recommendations";
const EnergyMap = lazy(() => import("../components/EnergyMap"));
export function Dashboard() {
  const { user, profile } = useAuth(); const navigate = useNavigate();
  const metrics = useResource(energyService.metrics); const articles = useResource(energyService.articles);
  const [article, setArticle] = useState<EnergyArticle | null>(null);
  useEffect(() => { void interactionService.track({ eventType: "VIEW_DASHBOARD", metadata: { path: "/" } }); }, [user?.uid]);
  const name = (profile?.name || user?.displayName || "comunidad").split(" ")[0];
  return <><PageHeading title={`Hola, ${name}. Hagamos parte del cambio.`} description="Tu punto de encuentro con las comunidades energéticas de Colombia."><span className="welcome-chip"><Leaf size={15}/>El futuro es compartido</span></PageHeading>
    <section className="dashboard-hero"><div className="hero-copy"><span className="eyebrow"><span className="status-dot"/> CONOCIMIENTO QUE CONECTA</span><h2>Una comunidad.<br/>Muchas formas de<br/><em>transformar la energía.</em></h2><p>Descubre las iniciativas, comprende las reglas y explora los datos que impulsan la transición energética.</p><Link to="/comunidades" className="button primary">Explorar comunidades<ArrowRight size={17}/></Link></div><div className="hero-art"><EnergyIllustration/><span className="illustration-label"><span className="status-dot"/>Energía · Territorio · Comunidad</span></div></section>
    <Recommendations/>
    <SectionHeading title="Mapa de comunidades energéticas" eyebrow="ENERGÍA EN EL TERRITORIO"/>
    <Suspense fallback={<Loading label="Preparando mapa…"/>}><EnergyMap/></Suspense>
    <SectionHeading title="Así se mueve nuestra energía" eyebrow="PANORAMA DEL SISTEMA ELÉCTRICO"><Link className="text-link" to="/datos">Explorar datos<ArrowUpRight size={16}/></Link></SectionHeading>
    {metrics.loading ? <div className="card"><Loading/></div> : metrics.error ? <ErrorState message={metrics.error} retry={metrics.refresh}/> : metrics.data && <MetricCards metrics={metrics.data.data} compact={profile?.preferences.compactMetrics} onSelect={id => navigate("/datos?metrica=" + id)}/>}
    <p className="data-disclaimer">Último día completo publicado por cada métrica · Fuente: XM · Las cifras pueden tener rezago de publicación.</p>
    <div className="dashboard-lower"><section><SectionHeading title="Tu próxima conexión" eyebrow="EXPLORA LA PLATAFORMA"/><div className="explore-list">{[
      { to: "/comunidades", icon: Users, title: "Comunidades energéticas", text: "Conoce iniciativas y explora los territorios." },
      { to: "/normativa", icon: Scale, title: "Normativa que orienta", text: "Consulta el marco regulatorio y sus fuentes." },
      { to: "/datos", icon: ChartNoAxesCombined, title: "Datos para comprender", text: "Generación, demanda y precio de bolsa." },
    ].map(({ to, icon: Icon, title, text }) => <Link className="card explore-item" key={to} to={to}><span className="icon-tile"><Icon size={22}/></span><div><h3>{title}</h3><p>{text}</p></div><ArrowUpRight size={18}/></Link>)}</div></section><section><SectionHeading title="Conocimiento para compartir" eyebrow="CONTENIDO OFICIAL"/>{articles.loading ? <Loading/> : articles.error ? <ErrorState message={articles.error} retry={articles.refresh}/> : articles.data?.data.slice(0, 1).map(item => <ArticleCard key={item.id} article={item} onOpen={setArticle}/>)}<div className="source-strip"><span className="source-strip-icon"><ShieldIcon/></span><div><strong>La información tiene una fuente.</strong><p>MinEnergía, CREG y XM. Cada contenido te lleva a su origen.</p></div></div></section></div>
    <ArticleDialog article={article} close={() => setArticle(null)}/></>;
}
function ShieldIcon() { return <Leaf size={22}/>; }
