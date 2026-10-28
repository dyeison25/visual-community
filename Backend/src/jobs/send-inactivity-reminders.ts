import { runInactivityReminderJob } from "../services/notifications/reminder.service";
import { assertReminderWorkflowPolicy } from "../services/notifications/workflow-policy";
import { ReminderConfigurationError, validateReminderCredentials } from "../services/notifications/credentials";

try {
  assertReminderWorkflowPolicy();
  if (process.env.GITHUB_ACTIONS === "true") validateReminderCredentials();
  const report = await runInactivityReminderJob();
  // Solo contadores: nunca direcciones, tokens ni contenido personalizado.
  console.log(JSON.stringify({ job: "inactivity-reminders", ...report }));
  if (report.failures || report.needsReview) process.exitCode = 1;
} catch (error) {
  // Mensajes del SDK pueden contener detalles privados. Revisar configuración y estado en Firestore.
  console.error(JSON.stringify({ job: "inactivity-reminders", status: "failed",
    code: error instanceof ReminderConfigurationError ? error.code : "reminder_job_failed",
    message: "El job no pudo completarse. Revisa la configuración privada y los registros de estado." }));
  process.exitCode = 1;
}
