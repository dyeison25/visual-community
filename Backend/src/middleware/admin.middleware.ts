import type { RequestHandler } from "express";
import { getFirestore } from "firebase-admin/firestore";
/** Comprueba el rol guardado en Firestore en cada petición, incluso si se escribe /admin a mano. */
export const requireAdmin: RequestHandler = async (_req, res, next) => {
  const uid = res.locals.user?.uid;
  if (typeof uid !== "string") { res.status(401).json({ message: "Inicia sesión para continuar." }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const profile = await getFirestore().collection("profiles").doc(uid).get();
    if (profile.data()?.role !== "admin") { res.status(403).json({ message: "Esta sección está disponible únicamente para administradores." }); return; }
    next();
  } catch {
    res.status(503).json({ message: "No pudimos comprobar tus permisos. Intenta nuevamente." });
  }
};
