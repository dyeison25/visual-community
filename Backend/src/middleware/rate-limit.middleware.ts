import type { RequestHandler } from "express";
const requests = new Map<string, { count: number; until: number }>();
export const rateLimit: RequestHandler = (_req, res, next) => {
  const now = Date.now();
  for (const [key, value] of requests) if (value.until < now) requests.delete(key);
  const uid = String(res.locals.user.uid);
  const entry = requests.get(uid) ?? { count: 0, until: now + 60000 };
  if (++entry.count > 90 || requests.size > 10000) {
    res.setHeader("Retry-After", "60"); res.status(429).json({ message: "Has realizado muchas consultas. Espera un minuto e intenta de nuevo." }); return;
  }
  requests.set(uid, entry); next();
};
