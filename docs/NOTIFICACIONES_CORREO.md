# Recordatorios por correo — Etapa 1

Implementación local para Visual Community, 27 de octubre de 2026. Frontend actual: https://sistemagestionpermanencia.web.app (Firebase Hosting). Backend actual: https://visual-community-api.onrender.com (Render). Esta entrega no crea un servicio de pago, no publica reglas y no habilita envíos generales. La Etapa 2 del mapa contextual requiere revisión posterior.

## Uso y consentimiento

La encuesta tiene una casilla opcional inicialmente desmarcada. Mi perfil permite activar o revocar los recordatorios; un fallo del backend revierte el control visible. Los perfiles antiguos sin campo se interpretan como desactivados. El cliente no puede editar directamente las fechas ni la preferencia: `POST /api/notifications/consent` obtiene el uid del ID token verificado y guarda la decisión con fecha del servidor. Los administradores no son destinatarios de recordatorios.

`profiles/{uid}.emailNotifications` contiene `enabled`, `consentedAt`, `revokedAt` y `updatedAt`. `notificationAudit` conserva los cambios. La fecha del último consentimiento se conserva al revocar; una nueva aceptación registra una nueva fecha. El backend no considera elegible un enabled=true que carezca de fecha de consentimiento.

## Actividad y ciclos

`POST /api/activity` registra retorno e interacción. El frontend limita los toques a uno por 15 minutos y reintenta tras un fallo con una espera mínima. Se usa la sesión reanudada, visibilidad y los eventos significativos ya registrados; no hay un temporizador que mantenga activo al usuario por dejar el navegador abierto.

`userActivity/{uid}` guarda `cycleId`, `lastActiveAt`, `lastMeaningfulEvent`, `updatedAt` y, cuando corresponda, `lastReminderAcceptedAt`. El ciclo permanece estable entre toques. Cuando el usuario regresa tras cuatro días sin actividad comienza un nuevo ciclo. Los eventos ya confirmados por Firestore sirven como respaldo si falló el toque HTTP. El cron consulta el último evento con fecha de servidor antes de decidir.

Un recordatorio es elegible tras cuatro días sin actividad, con consentimiento activo y, además, siete días desde el último correo aceptado. Se envía como máximo uno por ciclo. El cron funciona sin navegador. Los usuarios antiguos sin actividad verificable no reciben recordatorios basados en fechas supuestas; al aceptar, volver o registrar eventos se empieza a contar con datos reales.

## Cola y recuperación

`emailReminders/{id}` identifica de forma determinista uid+ciclo+versión del recordatorio. La existencia del documento nunca es por sí sola una razón para omitirlo. Estados:

- `sending`: un worker tiene un lease de cinco minutos.
- `accepted`: Resend devolvió un identificador. Significa aceptado por el proveedor, no entrega garantizada al buzón.
- `retryable`: rechazo transitorio confirmado (por ejemplo 429); espera `nextAttemptAt`.
- `uncertain`: timeout, red, 5xx o respuesta sin identificador; se recupera con la misma petición.
- `failed_permanent`: rechazo definitivo del proveedor.
- `needs_review`: resultado incierto fuera de la ventana, intentos agotados o copia que no puede verificarse.
- `skipped`: cambió consentimiento, actividad o correo antes del envío.

Se usa transacción Firestore para reclamar y un `leaseId` para impedir que un worker anterior sobrescriba el resultado de otro. Hay hasta tres intentos, con esperas de 15 y 60 minutos. El cron se recomienda cada 15 minutos, no una vez al día, para recuperar dentro de la ventana de idempotencia.

La copia exacta del cuerpo se cifra con AES-256-GCM y se guarda en `envelope`, con `payloadHash`. Incluye el destinatario original necesario para recuperar la petición. No se guardan en claro el correo ni el token de baja. Cambiar el nombre, preferencias, remitente o despliegue no altera el mensaje en un reintento. El secreto no debe rotarse mientras haya envíos pendientes; si no puede descifrarse el mensaje se detiene en `needs_review`.

Resend conserva claves 24 horas. La aplicación permite recuperación durante 23 horas, dejando un margen. Si Resend acepta y falla el guardado en Firestore, el estado permanece `sending`; al expirar el lease se repite exactamente el cuerpo y la clave, recuperando el mismo identificador sin enviar un segundo correo dentro de la ventana. Si pasó la ventana o se agotaron intentos, no se crea otra clave ni se reenvía automáticamente. Debe revisarse el dashboard de Resend usando la etiqueta `reminder_id`, confirmar el resultado y corregir el estado mediante un entorno administrativo. Nunca borrar un documento incierto para forzar el reenvío. No se promete entrega exactamente una vez frente a fallos arbitrarios del proveedor.

`emailReminders/{id}/attempts/{leaseId}` conserva inicio y resultado de cada intento. `notificationJobs/inactivity` contiene el lock del job, cursores y resumen. La selección pagina por perfiles con consentimiento y conserva un cursor en ejecuciones reales para evitar que usuarios ya notificados bloqueen los siguientes. También recupera envíos pendientes de ciclos anteriores. La comprobación de consentimiento y actividad se repite justo antes del HTTP; una petición que ya esté en vuelo no puede cancelarse después de ser aceptada por Resend.

Una lista de UIDs no vacía se comprueba en ambos recorridos antes de reparar actividad o reclamar/cancelar recordatorios. Un ensayo con un único UID no modifica registros individuales de otros usuarios. El lock y los cursores globales de `notificationJobs/inactivity` siguen coordinando las ejecuciones reales; no son registros individuales. Como antes, la lista también restringe el modo general si se configura allí. El envío test exige una lista explícita; un dry-run con lista vacía puede contar candidatos sin escribir ni enviar.

## Baja pública

Cada correo tiene un enlace a `/notificaciones/baja#t=...`. La ruta está fuera de los controles de sesión. Abrirla únicamente muestra la confirmación; no se llama al backend hasta pulsar el botón. El token se conserva en memoria y se retira de la barra de direcciones. El fragmento no se transmite a Firebase Hosting en la petición de página.

El token es un HMAC-SHA256 opaco derivado de un secreto aleatorio de servidor y del identificador del recordatorio. Solo se almacena su hash en `unsubscribeTokens`. Tiene 45 días de vigencia, `usedAt` y una asociación inmutable al uid. El POST público exige token y `confirm: true`, rechaza campos extra y no acepta un uid. Una transacción valida expiración y uso, desactiva solo el perfil vinculado y marca el token usado. Un segundo uso o un token alterado no cambia preferencias. El limitador público es por IP y memoria de instancia; los límites se reinician con el proceso. No hay endpoint de baja por GET.

## Personalización y enlaces

Se combinan preferencias declaradas y categorías de hasta 50 interacciones recientes; se reutiliza la clasificación temática existente. No se llama a Gemini ni a Algolia por cada correo. Si no hay señal real se usa una invitación general. No se inventan consultas, departamentos ni municipios.

Las rutas existentes verificadas son `/`, `/buscar?category=...` y `/perfil`. Se utiliza `FRONTEND_URL` como origen único. La ruta de búsqueda y sus parámetros sobreviven a la redirección al login. La baja pública usa la nueva ruta descrita arriba. Firebase Hosting ya tiene rewrite SPA; no requiere otra regla de Hosting.

## Variables de Render

| Nombre | Uso / configuración segura inicial |
|---|---|
| FIREBASE_PROJECT_ID | Proyecto existente, tanto API como Cron |
| FIREBASE_CLIENT_EMAIL | Firebase Admin privado, tanto API como Cron |
| FIREBASE_PRIVATE_KEY | Firebase Admin privado; admite saltos escapados, tanto API como Cron |
| FRONTEND_URL | Origen de Firebase Hosting: https://sistemagestionpermanencia.web.app |
| RESEND_API_KEY | Clave privada de envío, solo Cron |
| EMAIL_FROM | Remitente verificado de Resend, solo Cron |
| NOTIFICATION_TOKEN_SECRET | Secreto aleatorio de al menos 32 caracteres, solo Cron; estable para recuperar mensajes cifrados |
| REMINDER_ENABLED | false inicialmente; habilita ejecución real únicamente si dry-run=false |
| REMINDER_DRY_RUN | true inicialmente; cualquier valor salvo false conserva simulación |
| REMINDER_SEND_MODE | test inicialmente; general solo tras aprobación posterior |
| REMINDER_TEST_USER_IDS | Uids de cuentas de prueba, separados por comas; obligatorio para envíos test |
| REMINDER_INACTIVITY_DAYS | 4 |
| REMINDER_MAX_ATTEMPTS | 3, máximo admitido 5 |
| REMINDER_BATCH_SIZE | 50, máximo 200; hasta diez páginas por tipo y ejecución |

El API no requiere credenciales de Resend para consentimientos o bajas: valida hashes en Firestore. El Cron no necesita Gemini/Algolia ni las variables CORS del servidor HTTP. Ambos comparten el proyecto Firestore. La clave privada no debe aparecer en Vite, Git, Docker ni logs.

## Pasos manuales y orden de publicación

1. Crear una cuenta Resend y verificar un dominio propio mediante los registros DNS indicados por el proveedor. El dominio gratuito web.app no permite administrar el DNS necesario para un remitente propio. El remitente de prueba de Resend tiene restricciones; no usarlo para participantes generales.
2. Crear una clave privada de envío limitada al dominio y guardarla solo en Render. Crear un secreto aleatorio de al menos 32 caracteres para el cifrado/token y conservarlo en el Cron.
3. Ejecutar las pruebas locales listadas abajo. Publicar primero las reglas revisadas desde la raíz con `bunx firebase deploy --only firestore:rules --project sistemagestionpermanencia`. Es un paso manual; no publica usuarios ni modifica índices Algolia.
4. Publicar la revisión del API en el servicio Render actual y luego el frontend en Firebase Hosting. Conservar `FRONTEND_ORIGIN=https://sistemagestionpermanencia.web.app` en el API y `VITE_API_BASE_URL=https://visual-community-api.onrender.com/api` durante el build web. Mantener los dominios actuales autorizados en Firebase Authentication.
5. Crear en Render un Cron Job con el mismo repositorio y Dockerfile de la raíz, contexto `.`, y **Docker Command** `bun dist/send-inactivity-reminders.js`. El contenedor ya copia ambos bundles. No usar el comando de arranque del API para el Cron.
6. Usar `*/15 * * * *` (UTC). Configurar las variables indicadas. La plantilla `deploy/render-reminders.yaml` permite revisar una configuración equivalente; importarla crea un servicio facturable y no se aplica automáticamente.
7. Mantener `REMINDER_ENABLED=false`, `REMINDER_DRY_RUN=true` y modo test. Trigger Run imprime solo contadores; candidatos simula, accepted debe ser cero. La simulación no llama a Resend ni escribe recordatorios/tokens/cursores.
8. Para un ensayo de envío posterior, elegir una cuenta de prueba que haya aceptado y cumpla el umbral. Configurar su uid en la lista, `REMINDER_ENABLED=true`, `REMINDER_DRY_RUN=false`, `REMINDER_SEND_MODE=test`. Probar correo, retorno, baja y ejecución repetida. No redirigir contenido de participantes reales a buzones de prueba.
9. Volver a modo seco al terminar. La activación general queda pendiente de revisión explícita. No modificar fechas de participantes reales para provocar recordatorios.

## Pruebas locales

Desde la raíz, ejecutar por separado (comparten puertos de emuladores):

```powershell
bun run typecheck
bun test Backend/tests
bun run test:notifications
# En PowerShell, filtra ambos proyectos de Playwright:
$env:VC_E2E_GREP='notificaciones'
bun run test:e2e
Remove-Item Env:VC_E2E_GREP
bun run build
```

Para filtrar E2E puede usarse `$env:VC_E2E_GREP='notificaciones'; bun run test:e2e`. La suite funciona en escritorio y móvil. Solo los tests sustituyen transporte de Resend; nunca se envía correo real. Se comprueban aislamiento por uid, consentimiento, tokens expirados/usados, concurrencia, leases, mensajes congelados, reintentos, ciclos, cooldown, eventos de respaldo y navegación tras login. Las reglas se prueban con el emulador oficial. La integración real con Resend y su entregabilidad requieren remitente y aprobación de ensayo posteriores; no se consideran ya verificadas por estas pruebas.

## Costos y límites

Consulta oficial al 27 de octubre de 2026: [Resend Free](https://resend.com/pricing) incluye 3.000 correos/mes y 100/día; Pro anuncia USD 20/mes para 50.000. Resend puede aplicar límites y restricciones de cuenta; verificar que el uso de recordatorios sea admisible en el plan elegido. No se activó un plan de pago.

[Render Cron](https://render.com/docs/cronjobs) cobra tiempo de ejecución con mínimo de USD 1/mes por servicio. El dominio remitente puede tener costo aparte. Firestore agrega lecturas, transacciones y almacenamiento según el volumen; por vuelta se recorren solo perfiles con consentimiento más envíos pendientes. El dry-run completo cada 15 minutos también consume lecturas: usarlo manualmente o suspender el cron hasta activar ensayos. No se consumen generaciones Gemini ni búsquedas Algolia para correo. Las tarifas pueden cambiar.

## Límites operativos

No se implementaron webhooks de entrega/rebote ni métricas públicas adicionales. `accepted` no prueba entrega al buzón. Revisar estados `needs_review`/`failed_permanent` en Firestore mediante herramientas administrativas y el proveedor; no hay panel nuevo de gestión de envíos. Mantener registros el tiempo necesario para auditoría/idempotencia; no borrar envíos aceptados del ciclo activo ni envelopes inciertos para ahorrar lecturas. El responsable debe acordar un plazo de retención antes de uso general. Las reglas actuales niegan acceso de navegador a estas colecciones, incluso para administradores; Firebase Admin de confianza controla los cambios. Los informes históricos de preproducción describen otro momento y no certifican esta nueva entrega.

Referencias técnicas: [API de envío](https://resend.com/docs/api-reference/emails/send-email), [ventana de idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys), [Cron de Render](https://render.com/docs/cronjobs).

## Archivos de esta etapa

Nuevos:

- `Backend/src/routes/activity.routes.ts`, `notification.routes.ts`.
- `Backend/src/services/notifications/`: `admin-db.ts`, `config.ts`, `types.ts`, `activity.service.ts`, `consent.service.ts`, `email.service.ts`, `envelope.ts`, `outbox.service.ts`, `personalization.service.ts`, `reminder.service.ts`, `unsubscribe.service.ts`.
- `Backend/src/jobs/send-inactivity-reminders.ts`.
- `Frontend/src/services/activityService.ts`, `notificationService.ts`, `Frontend/src/pages/UnsubscribePage.tsx`.
- `Backend/tests/notifications.test.ts`, `Backend/tests/support/notifications.ts`, `tests/notifications.integration.test.ts`, `tests/e2e/notifications.spec.ts`.
- `deploy/render-reminders.yaml` y esta guía.

Modificados:

- `shared/models.ts`, `firestore.rules`, `tests/firestore.rules.test.ts`.
- `Backend/src/app.ts`, `Backend/src/middleware/rate-limit.middleware.ts`, `Backend/tests/auth.test.ts`, `Backend/package.json`, `Backend/.env.example`, `Backend/README.md`.
- `Frontend/src/App.tsx`, `Frontend/src/components/AccessRoutes.tsx`, `Layout.tsx`, `Frontend/src/pages/AuthPage.tsx`, `OnboardingPage.tsx`, `ProfilePage.tsx`, `PrivacyPage.tsx`.
- `Frontend/src/services/profileService.ts`, `interactionService.ts`, `Frontend/src/styles.css`, `Frontend/vite.config.ts`.
- `scripts/dev.ts`, `scripts/check-client-secrets.mjs`, `scripts/verify-built-api.ts`, `package.json`, `README.md`, `docs/PRODUCCION.md`.

Sin cambios en datos reales, índices Algolia, mapa existente, proveedores Gemini/MinEnergía/CREG/XM, Dockerfile o configuración Hosting. No se instalaron dependencias nuevas: el adaptador de correo usa la API REST oficial con `fetch` del backend Bun. No se modificaron archivos `.env` privados.

## Verificación de esta entrega

- TypeScript de backend, frontend y herramientas: correcto.
- Backend: 88 pruebas correctas, incluidos controles del transporte y modo seco.
- Integración con Firestore Emulator y reglas: 25 pruebas correctas (13 de notificaciones y 12 de seguridad).
- Interfaz: cuatro pruebas correctas entre escritorio y móvil; incluyen registro con/sin consentimiento, perfil, fallo del API, retorno tras login y baja pública que exige confirmación. Capturas locales de la baja en `artifacts/notifications-unsubscribe-*.png`.
- Empaquetado/credenciales excluidas: tres pruebas correctas.
- Build de API, Cron y frontend: correcto; revisión de secretos del bundle sin filtraciones detectadas.
- API compilada: inicia en modo producción y rechaza acceso anónimo a las nuevas rutas protegidas. Job compilado con envío desactivado: cero candidatos procesados y cero correos aceptados.

Los rechazos PERMISSION_DENIED de las pruebas de reglas son los esperados. El SDK mostró una advertencia de metadatos durante el emulador, sin fallos de pruebas. No se ejecutó envío real a Resend, publicación de estas reglas, creación de Cron de pago ni validación de esta revisión en los dominios publicados. Esos pasos permanecen manuales.
