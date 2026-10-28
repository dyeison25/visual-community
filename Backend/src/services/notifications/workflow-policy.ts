import { emailProvider, reminderSettings } from "./config";

/** Programación general y ensayos manuales tienen políticas separadas; nunca PR, forks u otras ramas. */
export function assertReminderWorkflowPolicy(env: NodeJS.ProcessEnv = process.env) {
  if (env.GITHUB_ACTIONS !== "true") return;
  if (!["workflow_dispatch", "schedule"].includes(env.GITHUB_EVENT_NAME || "") || env.GITHUB_REPOSITORY !== "dyeison25/visual-community" || env.GITHUB_REF !== "refs/heads/main"
    || env.FIREBASE_PROJECT_ID !== "sistemagestionpermanencia" || env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST
    || emailProvider(env) !== "gmail_smtp") {
    throw new Error("El workflow de recordatorios requiere un evento, repositorio, rama y proyecto autorizados.");
  }
  const settings = reminderSettings(env);
  if (settings.inactivityMs !== 4 * 86_400_000) throw new Error("El workflow requiere el umbral de 96 horas.");
  if (env.GITHUB_EVENT_NAME === "schedule") {
    if (env.REMINDER_SEND_MODE !== "live" || !settings.enabled || settings.dryRun || settings.testUserIds.size) {
      throw new Error("La programación requiere envío general live habilitado y sin lista de prueba.");
    }
    return;
  }
  if (env.REMINDER_SEND_MODE !== "test") throw new Error("Los ensayos manuales solo permiten modo test.");
  if (!settings.dryRun && (!settings.enabled || env.VC_REMINDER_CONFIRM_SEND !== "true" || !settings.testUserIds.size)) {
    throw new Error("El ensayo real requiere habilitación explícita, confirmación y una lista privada de UIDs de prueba.");
  }
}
