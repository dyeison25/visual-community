import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { browserLocalPersistence, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail, type User } from "firebase/auth";
import { auth } from "../config/firebase";
import type { UserProfile } from "../../../shared/models";
import { profileService } from "../services/profileService";
import { interactionService } from "../services/interactionService";
import { validateCredentials } from "../../../shared/validation";
interface AuthState {
  user: User | null; profile: UserProfile | null; loading: boolean; busy: boolean; notice: string;
  profileLoading: boolean; profileError: boolean; retryProfile: () => void;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>; setNotice: (message: string) => void;
}
const Context = createContext<AuthState | null>(null);
/**
 * Comparte la sesión y el perfil con todas las pantallas.
 * Escucha los cambios de Firebase para recuperar la sesión al recargar la página
 * y mantiene el perfil sincronizado con Firestore mientras haya un usuario autenticado.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, current => { setUser(current); setProfile(null); setProfileLoading(Boolean(current)); setProfileError(false); setLoading(false); }, () => { setUser(null); setLoading(false); setNotice("No pudimos recuperar tu sesión. Inicia sesión nuevamente."); });
  }, []);
  // Esperamos el perfil antes de decidir si corresponde la encuesta o una ruta administrativa.
  useEffect(() => {
    if (!user || busy) return;
    let active = true; let unsubscribe: (() => void) | undefined;
    setProfileLoading(true); setProfileError(false);
    const failed = () => { if (active) { setProfileError(true); setProfileLoading(false); } };
    void profileService.ensure(user.uid, user.displayName || "Miembro").then(() => {
      if (!active) return;
      unsubscribe = profileService.subscribe(user.uid, current => {
        if (active) { setProfile(current); setProfileLoading(false); setProfileError(!current); }
      }, failed);
    }).catch(failed);
    return () => { active = false; unsubscribe?.(); };
  }, [user?.uid, busy, profileAttempt]);
  /**
   * Marca una operación de acceso como ocupada y limpia el aviso anterior.
   * Al terminar, incluso si ocurre un error, libera ese estado para volver a usar el formulario.
   */
  async function perform(action: () => Promise<void>) {
    if (!auth) throw new Error("Firebase pendiente de configuración");
    setBusy(true); setNotice("");
    try { await action(); } finally { setBusy(false); }
  }
  /**
   * Valida los datos y pide a Firebase Authentication crear la cuenta.
   * Con el uid recibido crea el perfil adicional y registra el evento REGISTER.
   * La contraseña se entrega a Authentication; nunca se guarda en el perfil de Firestore.
   * Si falla la sincronización del perfil, conserva la cuenta creada y muestra un aviso.
   */
  async function register(name: string, email: string, password: string) {
    const invalid = validateCredentials(email, password, true, name);
    if (invalid) throw new Error(invalid);
    await perform(async () => {
      await setPersistence(auth!, browserLocalPersistence);
      const result = await createUserWithEmailAndPassword(auth!, email.trim(), password);
      try {
        await updateProfile(result.user, { displayName: name.trim() });
        await profileService.ensure(result.user.uid, name);
      } catch { setNotice("Tu cuenta se creó. Reintenta la conexión para completar tu perfil y la encuesta."); }
      await interactionService.track({ eventType: "REGISTER" });
    });
  }
  /**
   * Pide a Firebase comprobar el correo y la contraseña y conservar la sesión en el navegador.
   * Después asegura que exista el perfil y registra LOGIN con el uid autenticado.
   * Recuperar una sesión al recargar la página no llama a esta función ni genera otro LOGIN.
   */
  async function login(email: string, password: string) {
    await perform(async () => {
      await setPersistence(auth!, browserLocalPersistence);
      const result = await signInWithEmailAndPassword(auth!, email.trim(), password);
      interactionService.reset();
      try { await profileService.ensure(result.user.uid, result.user.displayName || "Miembro"); }
      catch { setNotice("Iniciaste sesión. No pudimos sincronizar tu perfil en este momento."); }
      await interactionService.track({ eventType: "LOGIN" });
    });
  }
  /**
   * Intenta registrar LOGOUT antes de cerrar la sesión, mientras el usuario aún tiene acceso.
   * Después cierra la sesión de Firebase, limpia el perfil de la pantalla y muestra un aviso.
   */
  async function logout() {
    await perform(async () => {
      await interactionService.track({ eventType: "LOGOUT" });
      await signOut(auth!);
      setProfile(null);
      setNotice("Cerraste sesión correctamente.");
    });
  }
  /**
   * Solicita a Firebase el correo de recuperación; Firebase gestiona el cambio de contraseña.
   */
  async function resetPassword(email: string) { await perform(async () => { await sendPasswordResetEmail(auth!, email.trim()); }); }
  return <Context.Provider value={{ user, profile, loading, profileLoading, profileError, retryProfile: () => setProfileAttempt(value => value + 1), busy, notice, register, login, logout, resetPassword, setNotice }}>{children}</Context.Provider>;
}
export function useAuth() { const state = useContext(Context); if (!state) throw new Error("AuthProvider requerido"); return state; }
