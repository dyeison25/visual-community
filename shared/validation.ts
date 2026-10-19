/**
 * Comprueba que el texto tenga un formato básico de correo y una longitud permitida.
 * No comprueba si ese buzón existe ni envía mensajes.
 */
export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
/**
 * Revisa correo y contraseña; en registro también revisa nombre y longitud de contraseña.
 * Devuelve el primer mensaje de error o null si los datos pasan estas comprobaciones.
 * La confirmación y el consentimiento se revisan en el formulario; Firebase verifica las credenciales.
 */
export function validateCredentials(email: string, password: string, registering = false, name = ""): string | null {
  if (!validEmail(email.trim())) return "Escribe un correo electrónico válido.";
  if (!password) return "Escribe tu contraseña.";
  if (registering && (name.trim().length < 2 || name.trim().length > 80)) return "Tu nombre debe tener entre 2 y 80 caracteres.";
  if (registering && (password.length < 8 || password.length > 128)) return "La contraseña debe tener entre 8 y 128 caracteres.";
  return null;
}
