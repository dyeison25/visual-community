/** Contrato independiente de Algolia, perfiles y eventos. No contiene datos personales. */
export const MAP_LAYERS = ["communities", "solar", "wind", "generation", "substations", "transmission", "connection"] as const;
export type MapLayerId = typeof MAP_LAYERS[number];
export type MapDisplay = "vector" | "wms";
/** Oeste, sur, este, norte en WGS84. Es un encuadre, nunca un límite administrativo. */
export type GeoBounds = [number, number, number, number];
export type GeoPosition = [number, number];
export type MapGeometry =
  | { type: "Point"; coordinates: GeoPosition }
  | { type: "LineString"; coordinates: GeoPosition[] }
  | { type: "MultiLineString"; coordinates: GeoPosition[][] }
  | { type: "Polygon"; coordinates: GeoPosition[][] }
  | { type: "MultiPolygon"; coordinates: GeoPosition[][][] };
export interface MapFeature {
  type: "Feature"; id: string; geometry: MapGeometry;
  properties: { title: string; facts: { label: string; value: string }[]; color: string };
}
export interface MapLayer {
  id: MapLayerId; title: string; geometry: "point" | "line" | "polygon";
  description: string; units: string; period: string; sourceUrl: string;
  attribution: string; warning: string; supportsTechnology: boolean; supportsWms: boolean;
}
export interface GeoPlace {
  departmentCode: string; department: string; municipalityCode?: string; municipality?: string;
}
export interface MapLegendEntry { label: string; color: string }
export interface MapContext {
  status: "none" | "choice" | "place_choice" | "ready";
  message: string; choices: MapLayer[]; layer: MapLayer | null;
  place: GeoPlace | null; placeChoices: GeoPlace[]; bounds: GeoBounds | null;
  coverageBounds?: GeoBounds;
  departments: { code: string; name: string }[];
  municipalities: { code: string; name: string }[];
  technologies: string[]; technology: string; inferredTechnology: string;
  display: MapDisplay; territorialMode: "none" | "attributes" | "extent";
  legend: MapLegendEntry[]; warnings: string[];
}
export interface MapData {
  type: "FeatureCollection"; features: MapFeature[]; truncated: boolean;
  discarded: number; limit: number; fetchedAt: string; bounds: GeoBounds | null;
  territorialMode: MapContext["territorialMode"];
}
export interface GeographyInput {
  q: string; category?: string; layer?: MapLayerId; department?: string;
  municipality?: string; technology?: string; display?: MapDisplay; bbox?: GeoBounds;
}
