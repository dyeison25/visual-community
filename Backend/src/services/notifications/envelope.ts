import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { notificationSecret } from "./config";
import type { FrozenEmail, SealedEmail } from "./types";

export const payloadHash = (message: FrozenEmail) => createHash("sha256").update(JSON.stringify(message)).digest("hex");
/** La copia exacta se cifra para recuperar un envío incierto sin guardar tokens/correos en claro. */
export function sealEmail(message: FrozenEmail, secret = notificationSecret()): SealedEmail {
  const iv = randomBytes(12); const key = createHash("sha256").update("email-envelope:v1:" + secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(message), "utf8"), cipher.final()]);
  return { iv: iv.toString("base64url"), ciphertext: ciphertext.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}
export function openEmail(envelope: SealedEmail, secret = notificationSecret()): FrozenEmail {
  const key = createHash("sha256").update("email-envelope:v1:" + secret).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]).toString("utf8")) as FrozenEmail;
}
