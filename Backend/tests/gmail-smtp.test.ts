import { afterEach, expect, test } from "bun:test";
import { createServer } from "node:net";
import { createTransport } from "nodemailer";
import { createGmailSmtpTransport, smtpFailure, type SmtpFactory } from "../src/services/notifications/transports/gmail-smtp.transport";
import { emailProvider, requiredEmailSettings } from "../src/services/notifications/config";
import { sendReminderEmail } from "../src/services/notifications/email.service";
import type { DispatchContext, FrozenEmail } from "../src/services/notifications/types";

// Valores exclusivamente sintéticos: no son credenciales de una cuenta Google.
const message: FrozenEmail = { from: "Visual Community <fixture@gmail.com>", to: ["recipient@example.invalid"], subject: "Prueba local", text: "Contenido", html: "<p>Contenido</p>", tags: [] };
const context: DispatchContext = { provider: "gmail_smtp", messageId: "<vc-test@gmail.com>", createdAt: 1_790_000_000_000 };
const fixtureEnv = { EMAIL_PROVIDER: "gmail_smtp", SMTP_USER: "fixture@gmail.com", SMTP_APP_PASSWORD: "abcdefghijklmnop", EMAIL_FROM: message.from, NOTIFICATION_TOKEN_SECRET: "fixture-only-".repeat(4) };
const keys = [...Object.keys(fixtureEnv), "REMINDER_ENABLED", "REMINDER_DRY_RUN", "REMINDER_SEND_MODE", "REMINDER_TEST_USER_IDS"];
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
afterEach(() => { for (const key of keys) { if (original[key] === undefined) delete process.env[key]; else process.env[key] = original[key]; } });

test("Gmail valida contraseña de aplicación, cuenta y remitente sin revelar valores", () => {
  const valid = requiredEmailSettings(fixtureEnv); expect(valid.provider).toBe("gmail_smtp");
  expect(emailProvider({})).toBe("resend"); expect(() => emailProvider({ EMAIL_PROVIDER: "unknown" })).toThrow();
  for (const patch of [{ SMTP_APP_PASSWORD: "normal-password" }, { SMTP_USER: "other@gmail.com" }, { EMAIL_FROM: "spoof@example.invalid" }, { EMAIL_FROM: "x\r\nBcc: other@example.invalid" }]) {
    expect(() => requiredEmailSettings({ ...fixtureEnv, ...patch })).toThrow();
  }
  const spaced = requiredEmailSettings({ ...fixtureEnv, SMTP_APP_PASSWORD: "abcd efgh ijkl mnop" });
  expect(spaced.provider === "gmail_smtp" && spaced.pass).toBe("abcdefghijklmnop");
});

test("SMTP usa TLS, desactiva logs/acceso a archivos y exige confirmación final del destinatario", async () => {
  let closed = false; let calls = 0;
  const factory: SmtpFactory = options => {
    expect(options.host).toBe("smtp.gmail.com"); expect(options.port).toBe(465); expect(options.secure).toBe(true);
    expect(options.tls.rejectUnauthorized).toBe(true); expect(options.logger).toBe(false); expect(options.debug).toBe(false);
    expect(options.disableFileAccess).toBe(true); expect(options.disableUrlAccess).toBe(true); expect(options.pool).toBe(false);
    return { async sendMail(mail) { calls++; expect(mail.messageId).toBe(context.messageId!); expect(mail.date.getTime()).toBe(context.createdAt); expect("tags" in mail).toBe(false); return { accepted: message.to, rejected: [], response: "250 2.0.0 OK" }; }, close() { closed = true; } };
  };
  const result = await createGmailSmtpTransport("fixture@gmail.com", "synthetic", factory).send(message, "stable", context);
  expect(result).toEqual({ status: "accepted", messageId: context.messageId }); expect(calls).toBe(1); expect(closed).toBe(true);
});

test("un Message-ID local o una respuesta incompleta nunca equivalen a aceptación", async () => {
  for (const result of [{ accepted: [], response: "250 OK" }, { accepted: message.to, response: "" }, { accepted: message.to, rejected: message.to, response: "250 OK" }]) {
    const factory: SmtpFactory = () => ({ sendMail: async () => result, close() {} });
    expect((await createGmailSmtpTransport("fixture@gmail.com", "synthetic", factory).send(message, "stable", context)).status).toBe("uncertain");
  }
});

test("clasifica rechazo temporal confirmado, cuenta bloqueada y fallos de red inciertos", () => {
  for (const [error, status] of [
    [{ responseCode: 451 }, "retryable"], [{ code: "EDNS" }, "retryable"], [{ responseCode: 550 }, "permanent"],
    [{ code: "EAUTH", responseCode: 535 }, "account_error"], [{ responseCode: 550, response: "5.4.5 Daily user sending limit exceeded" }, "account_error"],
    [{ code: "ECONNECTION", command: "CONN" }, "uncertain"], [{ code: "ETIMEDOUT", command: "CONN" }, "uncertain"],
    [new Error("synthetic-private-detail"), "uncertain"],
  ] as const) {
    const result = smtpFailure(error); expect(result.status).toBe(status); expect(JSON.stringify(result)).not.toContain("synthetic-private-detail");
  }
});

test("la fecha límite SMTP cierra el transporte sin reintentar ni filtrar el error", async () => {
  let calls = 0; let closed = false;
  const factory: SmtpFactory = () => ({ sendMail() { calls++; return new Promise(() => {}); }, close() { closed = true; } });
  const result = await createGmailSmtpTransport("fixture@gmail.com", "synthetic", factory, 5).send(message, "stable", context);
  expect(result.status).toBe("uncertain"); expect(calls).toBe(1); expect(closed).toBe(true);
});

test("dry run, deshabilitado y UID excluido no requieren credenciales ni abren un transporte", async () => {
  Object.assign(process.env, fixtureEnv, { SMTP_APP_PASSWORD: "", REMINDER_SEND_MODE: "test", REMINDER_TEST_USER_IDS: "allowed" });
  for (const [enabled, dry, uid, expected] of [["false", "true", "allowed", "simulated"], ["false", "false", "allowed", "disabled"], ["true", "false", "other", "disabled"]] as const) {
    process.env.REMINDER_ENABLED = enabled; process.env.REMINDER_DRY_RUN = dry;
    expect((await sendReminderEmail(message, "stable", uid!, context)).status).toBe(expected!);
  }
  Object.assign(process.env, fixtureEnv, { REMINDER_ENABLED: "true", REMINDER_DRY_RUN: "false" });
  expect((await sendReminderEmail(message, "stable", "allowed", { ...context, provider: "resend" })).status).toBe("account_error");
  let factories = 0;
  const transport = createGmailSmtpTransport("fixture@gmail.com", "synthetic", () => { factories++; throw Error("No conexión"); });
  expect((await transport.send(message, "stable")).status).toBe("account_error");
  expect((await transport.send({ ...message, from: "other@gmail.com" }, "stable", context)).status).toBe("account_error"); expect(factories).toBe(0);
});

test("Nodemailer funciona con Bun contra un servidor SMTP exclusivamente local", async () => {
  let accepted = 0; let content = "";
  const server = createServer(socket => {
    socket.setEncoding("utf8"); socket.write("220 localhost SMTP fixture\r\n"); let buffer = ""; let inData = false;
    socket.on("data", chunk => { buffer += chunk; let end;
      while ((end = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (inData) { if (line === ".") { inData = false; accepted++; socket.write("250 2.0.0 queued locally\r\n"); } else content += line + "\n"; }
        else if (/^EHLO/.test(line)) socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
        else if (/^AUTH/.test(line)) socket.write("235 2.7.0 authenticated\r\n");
        else if (/^(MAIL FROM|RCPT TO)/.test(line)) socket.write("250 2.1.0 OK\r\n");
        else if (line === "DATA") { inData = true; socket.write("354 End with dot\r\n"); }
        else if (line === "QUIT") socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); if (!address || typeof address === "string") throw Error("No local port");
    const factory: SmtpFactory = options => createTransport({ ...options, host: "127.0.0.1", port: address.port, secure: false, ignoreTLS: true });
    expect((await createGmailSmtpTransport("fixture@gmail.com", "synthetic", factory).send(message, "stable", context)).status).toBe("accepted");
    expect(accepted).toBe(1); expect(content).toContain("Message-ID: " + context.messageId);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
