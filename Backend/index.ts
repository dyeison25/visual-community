import { app } from "./src/app";
import { validateProductionEnvironment } from "./src/config/production.config";
validateProductionEnvironment();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT debe ser un puerto válido.");
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const server = app.listen(port, host, () => console.log(`Visual Community API: puerto ${port}`));
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  // Cloud Run permite un plazo breve antes de terminar una instancia.
  const deadline = setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 8000);
  deadline.unref();
  server.close(() => { clearTimeout(deadline); process.exit(0); });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
