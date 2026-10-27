import { doc, serverTimestamp, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import type { UserProfile } from "../../../shared/models";
import { profileTopics, validatePreferences } from "../../../shared/preferences";
import { deadline } from "./errors";
/** Construye la referencia del perfil propio. Firestore verifica además sus reglas de acceso. */
function ref(uid: string) {
  if (!db || auth?.currentUser?.uid !== uid) throw new Error("Sesión requerida");
  return doc(db, "profiles", uid);
}
export const profileService = {
  /** Crea perfiles nuevos como user; completa campos antiguos sin reemplazar datos ni roles. */
  async ensure(uid: string, name: string) {
    const target = ref(uid);
    await deadline(runTransaction(db!, async transaction => {
      const snapshot = await transaction.get(target);
      if (!snapshot.exists()) {
        const safeName = name.trim().slice(0, 80);
        transaction.set(target, {
          userId: uid, name: safeName.length >= 2 ? safeName : "Miembro",
          interests: [], preferences: { compactMetrics: false, topics: [], formats: [] },
          role: "user", onboardingCompleted: false,
          emailNotifications: { enabled: false },
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        return;
      }
      const profile = snapshot.data() as UserProfile;
      const patch: Record<string, unknown> = {};
      if (profile.role === undefined) patch.role = "user";
      if (profile.onboardingCompleted === undefined) patch.onboardingCompleted = false;
      if (profile.preferences.topics === undefined || profile.preferences.formats === undefined)
        patch.preferences = { ...profile.preferences, topics: profileTopics(profile), formats: profile.preferences.formats ?? [] };
      if (Object.keys(patch).length) transaction.update(target, { ...patch, updatedAt: serverTimestamp() });
    }));
  },
  /** Mantiene visibles los cambios del perfil y del rol sin tener que cerrar sesión. */
  subscribe(uid: string, next: (profile: UserProfile | null) => void, error: () => void) {
    return onSnapshot(ref(uid), { includeMetadataChanges: true }, snapshot => {
      // Una escritura local pendiente no confirma la encuesta ni concede un rol.
      if (!snapshot.metadata.hasPendingWrites) next(snapshot.exists() ? snapshot.data() as UserProfile : null);
    }, error);
  },
  async save(uid: string, name: string, compactMetrics: boolean) {
    if (name.trim().length < 2 || name.trim().length > 80) throw new Error("Perfil inválido");
    await deadline(updateDoc(ref(uid), { name: name.trim(), "preferences.compactMetrics": compactMetrics, updatedAt: serverTimestamp() }));
  },
  /** Guarda las elecciones y marca la encuesta completa en una sola escritura confirmada. */
  async savePreferences(uid: string, topics: string[], formats: string[]) {
    const invalid = validatePreferences(topics, formats);
    if (invalid) throw new Error(invalid);
    await deadline(updateDoc(ref(uid), {
      "preferences.topics": topics, "preferences.formats": formats,
      onboardingCompleted: true, updatedAt: serverTimestamp(),
    }));
  },
};
