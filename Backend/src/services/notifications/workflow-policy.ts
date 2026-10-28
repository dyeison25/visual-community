import { emailProvider, reminderSettings } from "./config";

/** Defensa adicional al if del workflow. Nunca acepta eventos PR, forks ni otras ramas. */
export function assertReminderWorkflowPolicy(env: NodeJS.ProcessEnv = process.env) {
  if (env.GITHUB_ACTIONS !== "true") return;
  if (env.GITHUB_EVENT_NAME !== "workflow_dispatch" || env.GITHUB_REPOSITORY !== "dyeison25/visual-community" || env.GITHUB_REF !== "refs/heads/main"
    || env.FIREBASE_PROJECT_ID !== "sistemagestionpermanencia" || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST
    || emailProvider(env) !== "gmail_smtp" || env.REMINDER_SEND_MODE !== "test") {
    throw new Error("El workflow de recordatorios solo admite ejecución manual de prueba en el repositorio y rama autorizados.");
  }
  const settings = reminderSettings(env);
  if (!settings.dryRun && (!settings.enabled || env.VC_REMINDER_CONFIRM_SEND !== "true" || !settings.testUserIds.size)) {
    throw new Error("El ensayo real requiere habilitación explícita, confirmación y una lista privada de UIDs de prueba.");
  }
}
