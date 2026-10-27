import type { UserProfile } from "../../../../shared/models";
import { profileTopics, topicLabel, TOPIC_OPTIONS } from "../../../../shared/preferences";
import { eventTopics, type InterestEvent } from "../discovery/interest.service";
import { frontendUrl } from "./config";

export function personalizedReminder(profile: UserProfile, events: InterestEvent[] = []) {
  const scores = new Map(profileTopics(profile).filter(id => TOPIC_OPTIONS.some(option => option.id === id)).map(id => [id, 3]));
  for (const event of events) for (const id of eventTopics(event)) scores.set(id, (scores.get(id) || 0) + 1);
  const topic = [...scores].sort((a, b) => b[1] - a[1])[0]?.[0]; const base = frontendUrl();
  if (topic) { base.pathname = "/buscar"; base.search = new URLSearchParams({ category: topic }).toString(); }
  else { base.pathname = "/"; base.search = ""; }
  const topicText = topic ? `información sobre ${topicLabel(topic).toLocaleLowerCase("es-CO")}` : "contenidos sobre energía y comunidades";
  return { topic, url: base.toString(), intro: topic ? `En Visual Community puedes seguir explorando ${topicText}, de acuerdo con tus preferencias y consultas. ¡Te esperamos de nuevo!` : "Hace unos días que no visitas Visual Community. Puedes volver a explorar información oficial sobre energía y comunidades energéticas." };
}
