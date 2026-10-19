import type { EnergyArticle, EnergyCommunity, EnergyMetric, Source } from "./models";
export type ContentKind="article"|"regulation"|"community"|"metric";
export interface EnergyContent {
  objectID:string; contentId:string; title:string; description:string; kind:ContentKind;
  category:string; topics:string[]; source:Source; sourceUrl:string;
  publishedAt:string|null; publishedTimestamp?:number; indexedAt:string; keywords:string[];
  department?:string; municipality?:string; views?:number; interactions?:number;
  article?:EnergyArticle; community?:EnergyCommunity; metric?:EnergyMetric;
}
export interface InterestProfile {
  userId:string; declaredPreferences:string[]; topicInteractionCounts:Record<string,number>;
  recentTopics:string[]; affinity:Record<string,number>; updatedAt:string; sampleSize:number;
  // Interés en lugares consultados; no representa la residencia del usuario.
  geography?: { departments:Record<string,number>; municipalities:{department:string;municipality:string;count:number}[] };
}
export interface SearchData { hits:EnergyContent[]; total:number; page:number; pages:number; provider:"algolia" }
export interface Recommendation { content:EnergyContent; reason:string }
export interface RecommendationsData { items:Recommendation[]; provider:"algolia"|"local"; message?:string }
export interface ChatTurn { role:"user"|"assistant"; content:string }
export interface ChatResult { answer:string; sources:EnergyContent[]; category?:string }
export function officialContentUrl(value:unknown): value is string {
  if(typeof value!=="string")return false;
  try { const u=new URL(value);return u.protocol==="https:" && !u.username && !u.password
    && ["www.minenergia.gov.co","minenergia.gov.co","creg.gov.co","www.creg.gov.co","gestornormativo.creg.gov.co","www.xm.com.co","xm.com.co","sinergox.xm.com.co"].includes(u.hostname)
    && !/\/rest\/|FeatureServer|MapServer|\/query|\.json(?:$|\?)/i.test(value);
  } catch{return false;}
}
