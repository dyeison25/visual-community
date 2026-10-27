import { getFirestore } from "firebase-admin/firestore";
import { getFirebaseAuth } from "../../config/firebase.config";

/** Inicializa Firebase Admin antes de usar Firestore, también en el proceso Cron. */
export function adminDb() {
  getFirebaseAuth();
  return getFirestore();
}
