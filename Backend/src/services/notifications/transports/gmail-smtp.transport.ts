import { createTransport } from "nodemailer";
import { senderAddress } from "../config";
import type { ProviderResult } from "../types";
import type { EmailTransport } from "./transport";

export type GmailOptions = {
  host: string; port: number; secure: boolean; auth: { user: string; pass: string };
  tls: { rejectUnauthorized: boolean }; connectionTimeout: number; greetingTimeout: number; socketTimeout: number;
  logger: false; debug: false; pool: false; disableFileAccess: true; disableUrlAccess: true;
};
export type SmtpMessage = { from: string; to: string[]; subject: string; text: string; html: string; messageId: string; date: Date };
export type SmtpClient = { sendMail(message: SmtpMessage): Promise<{ accepted: string[]; rejected?: string[]; response: string }>; close(): void };
export type SmtpFactory = (options: GmailOptions) => SmtpClient;
const nodemailerFactory: SmtpFactory = options => createTransport(options);

/** Nunca conserva el error original: puede incluir direcciones o detalles de autenticación. */
export function smtpFailure(error: unknown): ProviderResult {
  const data = error && typeof error === "object" ? error as { code?: unknown; responseCode?: unknown; response?: unknown } : {};
  const code = typeof data.responseCode === "number" ? data.responseCode : 0;
  if (data.code === "EAUTH" || code === 535 || code === 534 || (typeof data.response === "string" && /5\.4\.5|daily.*limit|sending.*limit/i.test(data.response))) {
    return { status: "account_error", code: "smtp_account_unavailable", message: "Revisar autenticación o cuota de la cuenta; se detuvo el lote." };
  }
  if (code >= 400 && code < 500 || data.code === "EDNS") return { status: "retryable", code: code ? "smtp_" + code : "smtp_dns", message: "Fallo confirmado sin aceptación; puede reintentarse en otra ejecución." };
  if (code >= 500 && code < 600) return { status: "permanent", code: "smtp_" + code, message: "El servidor rechazó definitivamente el mensaje." };
  // ECONNECTION y ETIMEDOUT también ocurren después de DATA: no prueban ausencia de aceptación.
  return { status: "uncertain", code: "smtp_outcome_unknown", message: "No se confirmó el resultado SMTP; requiere revisión sin reenvío automático." };
}

export function createGmailSmtpTransport(user: string, pass: string, factory: SmtpFactory = nodemailerFactory, timeoutMs = 90_000): EmailTransport {
  return { provider: "gmail_smtp", async send(message, _key, context) {
    if (!context?.messageId || context.provider !== "gmail_smtp" || senderAddress(message.from) !== user || message.to.length !== 1) {
      return { status: "account_error", code: "smtp_dispatch_configuration", message: "No se pudo validar el remitente o la reserva del envío SMTP." };
    }
    let client: SmtpClient | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      client = factory({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass }, tls: { rejectUnauthorized: true },
        connectionTimeout: 20_000, greetingTimeout: 20_000, socketTimeout: 30_000, pool: false, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true });
      const result = await Promise.race([
        client.sendMail({ from: message.from, to: message.to, subject: message.subject, text: message.text, html: message.html,
          messageId: context.messageId, date: new Date(context.createdAt) }),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("SMTP deadline")), timeoutMs); }),
      ]);
      if (result.accepted.length === 1 && result.accepted[0]?.toLowerCase() === message.to[0]?.toLowerCase() && !result.rejected?.length && /^250\b/.test(result.response)) {
        // Message-ID es correlación local, no un identificador/idempotencia garantizados por Gmail.
        return { status: "accepted", messageId: context.messageId };
      }
      return { status: "uncertain", code: "smtp_acceptance_unconfirmed", message: "No se confirmó la aceptación del destinatario; revisar antes de reenviar." };
    } catch (error) { return smtpFailure(error); }
    finally { if (timer) clearTimeout(timer); try { client?.close(); } catch { /* No reemplazar un resultado ya conocido por un error de cierre. */ } }
  } };
}
