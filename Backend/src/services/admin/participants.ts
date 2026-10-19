/** Se usa el rol actual: una cuenta administrativa nunca entra en el análisis de participantes. */
export function participantIds(accountIds: string[], profiles: { id: string; role?: unknown }[]): string[] {
  const administrators = new Set(profiles.filter(profile => profile.role === "admin").map(profile => profile.id));
  return [...new Set([...accountIds, ...profiles.map(profile => profile.id)])].filter(uid => !administrators.has(uid)).sort();
}
