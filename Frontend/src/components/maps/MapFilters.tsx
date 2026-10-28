import type { MapContext } from "../../../../shared/geography";
export type ChangeMapFilter = (values: Record<string, string>) => void;
export function MapFilters({ context, department, municipality, change }: { context: MapContext; department: string; municipality: string; change: ChangeMapFilter }) {
  return <div className="geo-filters">
    <label>Departamento del mapa<select aria-label="Departamento del mapa" value={department} onChange={e => change({ mapDepartment: e.target.value, mapMunicipality: "", mapDisplay: "" })}>
      <option value="">Según la búsqueda{context.place ? " (" + context.place.department + ")" : " / Colombia"}</option>
      {context.departments.map(row => <option key={row.code} value={row.code}>{row.name}</option>)}
    </select></label>
    <label>Municipio del mapa<select aria-label="Municipio del mapa" value={municipality} disabled={!context.municipalities.length} onChange={e => change({ mapDepartment: department || context.place?.departmentCode || "", mapMunicipality: e.target.value, mapDisplay: "" })}>
      <option value="">{context.place?.municipality && !department ? "Según búsqueda: " + context.place.municipality : "Todo el departamento"}</option>
      {context.municipalities.map(row => <option key={row.code} value={row.code}>{row.name}</option>)}
    </select></label>
    {context.layer?.supportsTechnology && <label>Tecnología del mapa<select aria-label="Tecnología del mapa" value={context.technology} onChange={e => change({ mapTechnology: e.target.value })}>
      <option value="">Según la búsqueda{context.inferredTechnology ? " (" + context.inferredTechnology + ")" : " / todas"}</option>
      <option value="all">Todas las tecnologías</option>{context.technologies.map(value => <option key={value} value={value}>{value}</option>)}
    </select></label>}
    {context.layer?.supportsWms && <label>Representación<select aria-label="Representación del mapa" value={context.display} onChange={e => change({ mapDisplay: e.target.value })}>
      <option value="vector">Geometrías y detalles</option><option value="wms" disabled={!!context.place}>Capa temática WMS nacional</option>
    </select></label>}
  </div>;
}
