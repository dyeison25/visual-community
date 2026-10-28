import type { MapLayer, MapLayerId } from "../../../../shared/geography";

export const UPME_REST = "https://geo.upme.gov.co/server/rest/services/";
export const DANE_BASE = "https://geoportal.dane.gov.co/mparcgis/rest/services/MGN2025/Serv_CapasMGN_2025/MapServer";
/** Respaldo histórico explícito, nunca presentado como límites administrativos actuales. */
export const UPME_TERRITORIES = UPME_REST + "SITIOSUPME/UPME_BC_Sitios_UPME_Division_Politica/MapServer";
const viewers = "https://sig.upme.gov.co/portal/apps/experiencebuilder/experience/?id=";
export interface LayerDefinition extends MapLayer {
  path: string; oid: string; nameField: string;
  facts: { field: string; label: string; date?: boolean }[];
  departmentField?: string; municipalityField?: string;
  departmentCodeField?: string; municipalityCodeField?: string; technologyField?: string;
  legendField?: string; color: string; wmsPath?: string;
}
const common = { attribution: "Unidad de Planeación Minero Energética — UPME", supportsWms: false, supportsTechnology: false };
export const layers: Record<MapLayerId, LayerDefinition> = {
  communities: { ...common, id: "communities", title: "Comunidades energéticas postuladas", geometry: "point",
    path: "Capas_EnergiaElectrica/comunidades_energeticas_postuladas/FeatureServer/19", oid: "OBJECTID", nameField: "NOMBRE_DE_",
    departmentField: "DEPARTAMEN", municipalityField: "MUNICIPIO", color: "#315c44",
    description: "Postulaciones publicadas por UPME con referencia a información de MinEnergía.", units: "Ubicaciones de postulaciones", period: "Consultar la vigencia en la fuente oficial",
    sourceUrl: "https://www.upme.gov.co/simec/geovisores/", warning: "Una postulación no confirma aprobación, ejecución ni operación de una comunidad.",
    facts: [{ field: "DEPARTAMEN", label: "Departamento" }, { field: "MUNICIPIO", label: "Municipio" }] },
  solar: { ...common, id: "solar", title: "Radiación solar", geometry: "polygon", supportsWms: true,
    path: "Capas_FuenteEnergia_Solar/radiacion_horizontal_media_dia_anual_2024/MapServer/3", oid: "OBJECTID", nameField: "rangos_rad_kWh_m_dia",
    wmsPath: "Capas_FuenteEnergia_Solar/radiacion_horizontal_media_dia_anual_2024", legendField: "rangos_rad_kWh_m_dia", color: "#d4a65d",
    departmentCodeField: "cod_dpto", municipalityCodeField: "cod_mpio", departmentField: "departamento", municipalityField: "municipio",
    description: "Radiación global horizontal media diaria anual.", units: "kWh/m²/día", period: "Capa denominada 2024; periodo de referencia en cada registro",
    sourceUrl: viewers + "82a2ffd8039b49c6a987248bc022ea02", warning: "Es un recurso climático de referencia, no generación eléctrica ni una medición en tiempo real.",
    facts: [{ field: "departamento", label: "Departamento" }, { field: "municipio", label: "Municipio" }, { field: "rangos_rad_kWh_m_dia", label: "Radiación (kWh/m²/día)" }, { field: "periodo_inicial", label: "Periodo inicial" }, { field: "periodo_final", label: "Periodo final" }] },
  wind: { ...common, id: "wind", title: "Potencial eólico a 20 metros", geometry: "polygon", supportsWms: true,
    path: "Capas_FuenteEnergia_Eolica/energia_eolica_20metros/MapServer/10", oid: "OBJECTID", nameField: "rango", color: "#bfc7fc",
    wmsPath: "Capas_FuenteEnergia_Eolica/energia_eolica_20metros", legendField: "rango",
    description: "Rangos del recurso eólico publicados en el atlas oficial.", units: "W/m², según el registro", period: "Datos históricos; fecha y fuente en cada registro",
    sourceUrl: viewers + "82a2ffd8039b49c6a987248bc022ea02", warning: "La capa no representa parques en operación ni velocidades actuales del viento. El atlas incluye datos históricos de IDEAM.",
    facts: [{ field: "rango", label: "Rango" }, { field: "unidad", label: "Unidad" }, { field: "fecha_dato", label: "Fecha del dato", date: true }, { field: "fuente_dato", label: "Fuente del dato" }] },
  generation: { ...common, id: "generation", title: "Proyectos y recursos de generación", geometry: "point", supportsTechnology: true,
    path: "Capas_EnergiaElectrica/proyectos_generacion_xm/FeatureServer/24", oid: "id", nameField: "nombre_recurso", color: "#b87c21",
    municipalityCodeField: "cod_mpio", departmentField: "departamento_oficial", municipalityField: "municipio_oficial", technologyField: "tipo_generacion",
    description: "Recursos de generación publicados por UPME con datos de XM.", units: "Capacidad efectiva neta (MW)", period: "Fecha del registro publicada por la fuente",
    sourceUrl: viewers + "4d4a81c194a64780a51d3ab557f4c51d", warning: "La capacidad en MW no equivale a energía producida en MWh ni a generación en tiempo real.",
    facts: [{ field: "departamento_oficial", label: "Departamento" }, { field: "municipio_oficial", label: "Municipio" }, { field: "tipo_generacion", label: "Tecnología" }, { field: "capacidad_efectiva_neta_mw", label: "Capacidad efectiva neta (MW)" }, { field: "estado_recurso", label: "Estado publicado" }, { field: "fecha", label: "Fecha del registro", date: true }] },
  substations: { ...common, id: "substations", title: "Subestaciones construidas", geometry: "point",
    path: "Capas_EnergiaElectrica/sistema_transmision_subestaciones_construidas/FeatureServer/18", oid: "OBJECTID", nameField: "nombre_subestacion", color: "#8055a2",
    departmentCodeField: "cod_dpto", municipalityCodeField: "cod_mpio", departmentField: "departamento", municipalityField: "municipio",
    description: "Infraestructura de subestaciones publicada por UPME.", units: "Tensión (kV)", period: "Última edición disponible por registro",
    sourceUrl: viewers + "76068f01ad1d40cdbf2e7d7cf84de86b", warning: "Información cartográfica de referencia; no describe el estado operativo instantáneo de la red.",
    facts: [{ field: "departamento", label: "Departamento" }, { field: "municipio", label: "Municipio" }, { field: "tension", label: "Tensión (kV)" }, { field: "last_edited_date", label: "Última edición", date: true }] },
  transmission: { ...common, id: "transmission", title: "Líneas de transmisión", geometry: "line",
    path: "Capas_EnergiaElectrica/convocatorias_lineas_transmision/FeatureServer/1", oid: "OBJECTID", nameField: "nombre_proyecto_upme", color: "#a34f37",
    description: "Trazados asociados a convocatorias de transmisión.", units: "Tensión (kV)", period: "Fecha de actualización disponible por registro",
    sourceUrl: viewers + "76068f01ad1d40cdbf2e7d7cf84de86b", warning: "El estado de cada convocatoria debe consultarse: no todos los trazados representan infraestructura en operación.",
    facts: [{ field: "nombre_tramo", label: "Tramo" }, { field: "tension_kv", label: "Tensión (kV)" }, { field: "estado_convocatoria", label: "Estado de la convocatoria" }, { field: "fecha_actualizacion", label: "Fecha publicada" }] },
  connection: { ...common, id: "connection", title: "Capacidad asignada y puntos de conexión", geometry: "point", supportsTechnology: true,
    path: "Capas_EnergiaElectrica/capacidad_asignada/FeatureServer/31", oid: "id", nameField: "nombre_proyecto", color: "#277b89",
    departmentCodeField: "cod_dpto", municipalityCodeField: "cod_mpio", departmentField: "departamento", municipalityField: "municipio", technologyField: "tecnologia",
    description: "Asignaciones de capacidad publicadas por UPME.", units: "Capacidad asignada vigente (MW)", period: "Fecha de actualización disponible por registro",
    sourceUrl: viewers + "46baf6f4d8684262b01bf888925e3c33", warning: "El marcador de conexión/asignación no debe interpretarse como la ubicación exacta de una planta ni como prueba de operación.",
    facts: [{ field: "departamento", label: "Departamento" }, { field: "municipio", label: "Municipio" }, { field: "tecnologia", label: "Tecnología" }, { field: "estado_proyecto", label: "Estado publicado" }, { field: "capacidad_asignada_vigente_mw", label: "Capacidad asignada (MW)" }, { field: "punto_conexion_seleccionado", label: "Punto de conexión" }, { field: "fecha_actualizacion", label: "Fecha de actualización", date: true }] },
};
export function publicLayer(id: MapLayerId): MapLayer {
  const { title, geometry, description, units, period, sourceUrl, attribution, warning, supportsTechnology, supportsWms } = layers[id];
  return { id, title, geometry, description, units, period, sourceUrl, attribution, warning, supportsTechnology, supportsWms };
}
export function permittedFields(layer: LayerDefinition) {
  return [...new Set([layer.oid, layer.nameField, ...layer.facts.map(f => f.field), layer.departmentCodeField, layer.municipalityCodeField].filter((field): field is string => !!field))];
}
