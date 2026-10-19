import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
export const usingEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
if (usingEmulators && (!import.meta.env.DEV || !localHost)) throw new Error("Los emuladores solo están disponibles en desarrollo local.");
const config = usingEmulators ? {
  // Identificadores públicos sintéticos EXCLUSIVOS del emulador oficial. No son credenciales reales.
  apiKey: "demo-api-key", authDomain: "demo-visual-community.firebaseapp.com",
  projectId: "demo-visual-community", appId: "demo-visual-community-web",
} : {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
const app = firebaseConfigured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
if (usingEmulators && auth && db) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
