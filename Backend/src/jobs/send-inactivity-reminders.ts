import { runInactivityReminderJob } from "../services/notifications/reminder.service";

try {
  const report = await runInactivityReminderJob();
  // Solo contadores: nunca direcciones, tokens ni contenido personalizado.
  console.log(JSON.stringify({ job: "inactivity-reminders", ...report }));
} catch {
  // Mensajes del SDK pueden contener detalles privados. Revisar configuración y estado en Firestore.
  console.error("El job de recordatorios no pudo completarse. Revisa la configuración privada y los registros de estado.");
  process.exitCode = 1;
}
