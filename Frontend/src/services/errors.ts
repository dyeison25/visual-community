/**
 * Traduce los códigos de error de Firebase a mensajes que el usuario pueda entender.
 * Si el código no está previsto, devuelve un mensaje general sin mostrar detalles técnicos.
 */
export function authError(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.",
    "auth/invalid-email": "Escribe un correo electrónico válido.",
    "auth/weak-password": "Elige una contraseña más segura, de al menos 8 caracteres.",
    "auth/password-does-not-meet-requirements": "La contraseña no cumple la política de seguridad del proyecto.",
    "auth/invalid-credential": "El correo o la contraseña no son correctos.",
    "auth/wrong-password": "El correo o la contraseña no son correctos.",
    "auth/user-not-found": "El correo o la contraseña no son correctos.",
    "auth/too-many-requests": "Has realizado varios intentos. Espera unos minutos antes de volver a intentar.",
    "auth/network-request-failed": "No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.",
    "auth/operation-not-allowed": "El acceso con correo aún no está habilitado. Contacta al administrador de la plataforma.",
    "auth/user-disabled": "Esta cuenta está deshabilitada. Contacta al administrador.",
    "auth/unauthorized-domain": "Este dominio aún no está autorizado para iniciar sesión.",
  };
  return messages[code] || "No pudimos completar la solicitud. Intenta nuevamente.";
}
/**
 * Espera una operación hasta el plazo indicado (6 segundos por defecto).
 * Si tarda más, lanza un error y libera la espera de la pantalla.
 * No cancela la operación original: una escritura en Firestore puede finalizar después.
 */
export async function deadline<T>(promise: Promise<T>, milliseconds = 6000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Tiempo de espera agotado")), milliseconds); })]); }
  finally { clearTimeout(timer!); }
}
