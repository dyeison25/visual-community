import { getFirebaseAuth } from "../config/firebase.config";
export class AuthService {
  /**
   * Comprueba con Firebase el comprobante de sesión recibido, llamado ID token.
   * También rechaza tokens revocados. Devuelve el uid, nombre y correo del usuario;
   * si Firebase rechaza el token, lanza un error que requireAuth convierte en un 401.
   */
  async verifySession(idToken: string) {
    const decoded = await getFirebaseAuth().verifyIdToken(idToken, true);
    return { uid: decoded.uid, name: decoded.name ?? null, email: decoded.email ?? null };
  }
}
