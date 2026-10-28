import { Component, Fragment, type ReactNode } from "react";
import { ErrorState } from "../UI";
/** Un error inesperado de dibujo no debe desmontar los resultados de Algolia. */
export class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  override state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() {
    return this.state.failed ? <section className="card contextual-map"><ErrorState message="No pudimos dibujar el mapa. Puedes continuar consultando los resultados de búsqueda." retry={() => this.setState(previous => ({ failed: false, attempt: previous.attempt + 1 }))}/></section>
      : <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
