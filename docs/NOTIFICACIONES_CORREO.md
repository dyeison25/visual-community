# Recordatorios por correo — Etapa 1

Actualización, 28 de octubre de 2026: Gmail SMTP con Nodemailer 10.2.1 y GitHub Actions; Resend se conserva por compatibilidad. La implementación `90fab5a` está publicada y su dry run manual terminó correctamente. El propietario autorizó activar el cron y el envío general de esta revisión al publicarse en `main`. Frontend: https://sistemagestionpermanencia.web.app (Firebase Hosting). API: https://visual-community-api.onrender.com (Render). No se cambian variables de Render, consentimientos, fechas de actividad, Hosting ni reglas. No se fuerzan usuarios elegibles ni se ejecutan ensayos de envío manuales adicionales. La Etapa 2 del mapa contextual queda fuera de alcance.

## Programación automática y separación de modos

El workflow programa `17 15 * * *`, todos los días a las 15:17 UTC, aproximadamente 10:17 de Colombia. El único paso habilitado por `schedule` configura `REMINDER_ENABLED=true`, `REMINDER_DRY_RUN=false`, `REMINDER_SEND_MODE=live` y `REMINDER_TEST_USER_IDS=''`. El código reconoce expresamente `live` como alias de `general`; un valor desconocido continúa siendo `test`. El alias por sí solo no borra ninguna lista: es el paso programado el que la vacía deliberadamente.

Solo pueden enviarse correos a perfiles con consentimiento y fecha válidos, excluyendo administradores, tras 96 horas desde la fecha más reciente de consentimiento/actividad y siete días desde la última aceptación. Se conservan bajas, ciclos, personalización, cuota global de 20 intentos SMTP/24 h e idempotencia de la cola. Los resultados SMTP inciertos siguen requiriendo revisión sin reenvío automático.

La ejecución `workflow_dispatch` utiliza un paso diferente: conserva `test`, `dry_run=true` y `confirm_send=false` como valores predeterminados. Para un ensayo real sigue exigiendo habilitación explícita mediante la variable `REMINDER_ENABLED=true`, confirmación y el secreto `REMINDER_TEST_USER_IDS`. La ejecución manual nunca admite `live`/general. El ejecutable valida de nuevo ambos eventos, repositorio original, rama `main`, proveedor Gmail, proyecto Firebase y umbral de 96 horas; rechaza PR, forks, otras ramas y emuladores.

Se comprobó por API que `reminder-tests` existe, permite la rama `main`, contiene los ocho nombres de Secrets, carece de revisores requeridos/temporizadores/reglas externas y que Actions y el workflow están activos. No fue necesario cambiar sus protecciones. No se pueden recuperar valores de Secrets por API: los valores se validan al arrancar el job. Conservar esa política sin aprobaciones humanas para permitir el cron; los ensayos manuales mantienen su confirmación explícita en el workflow.

La validación previa exige las tres credenciales Firebase, analiza la clave RSA con saltos reales, CRLF o `\\n` escapados y comprueba `NOTIFICATION_TOKEN_SECRET` sin decodificarlo ni transformarlo más allá del trim ya existente. Para enviar también valida cuenta Gmail, remitente y formato de contraseña de aplicación. Cualquier error termina antes de usar Firestore o SMTP, con códigos no sensibles como `firebase_private_key_invalid` o `email_configuration_invalid`. Una autenticación SMTP rechazada durante el envío detiene el lote. No se muestran claves, mensajes SMTP originales ni trazas.

## Configuración de Secrets y ensayos manuales

El job reutiliza consentimiento, actividad, preferencias, bajas, roles y cola. `EMAIL_PROVIDER=gmail_smtp` selecciona Gmail; la ausencia de la variable conserva Resend para no alterar despliegues anteriores. Los adaptadores están en `Backend/src/services/notifications/transports/`. No hay failover automático entre proveedores. Nodemailer incluye sus tipos y funciona con Bun en las pruebas de protocolo SMTP local; no se ha probado todavía autenticación o entregabilidad reales de Google.

Gmail usa `smtp.gmail.com:465`, TLS con certificados verificados y una contraseña de aplicación de 16 caracteres. Se admite una cuenta personal `gmail.com`/`googlemail.com`; `EMAIL_FROM` debe contener esa misma dirección, opcionalmente con nombre visible. Nunca se usa la contraseña normal de Google. Se desactivan logs SMTP, acceso a archivos y URLs de contenido. Hay límites de conexión y una fecha límite total de 90 segundos, inferior al lease del envío.

Configuración que debe mantenerse para las ejecuciones programadas y los ensayos:

1. Crear o elegir una cuenta Gmail dedicada, habilitar verificación en dos pasos y comprobar que permite generar una contraseña de aplicación. Si la política de Google no lo permite, detenerse y evaluar OAuth; no bajar la seguridad de la cuenta.
2. En GitHub → Settings → Environments, conservar **`reminder-tests`** y permitir despliegue solo desde `main`. No añadir revisores requeridos, temporizadores ni reglas externas de aprobación: bloquearían también los envíos programados. Configurar las credenciales como **Environment Secrets**, sin introducirlas en archivos, comandos, inputs ni mensajes de chat.
3. Añadir los ocho Secrets de la tabla. Mantener el secreto de notificaciones ya utilizado, sin rotarlo con mensajes pendientes. Las credenciales Firebase deben corresponder a `sistemagestionpermanencia` y tener solo los permisos necesarios para Firestore y lectura de cuentas de Authentication.
4. Para los ensayos manuales, mantener la variable **`REMINDER_ENABLED=false`** (su ausencia también equivale a false), `dry_run=true` y `confirm_send=false` por defecto. El paso programado fija sus propios valores reales y no depende de esa variable manual.
5. Elegir una cuenta de prueba `user` con consentimiento desde la plataforma. Para ser candidata deben transcurrir 96 horas desde la fecha más reciente de consentimiento y actividad. No editar fechas de usuarios reales ni entrar a esa cuenta durante el periodo de inactividad.
6. Solo tras autorización, ejecutar manualmente Actions → Recordatorios por correo → Run workflow en `main`, conservando `dry_run=true`. Una simulación consulta Firestore, pero no Auth, SMTP, cuotas, tokens, cursores ni escrituras del job. Con lista vacía puede contar todos los candidatos consentidos sin escribir; preferir un UID para el ensayo.
7. Para un ensayo real posterior y autorizado: configurar un único UID, cambiar temporalmente la variable a `REMINDER_ENABLED=true`, elegir `dry_run=false` y `confirm_send=true`. Se necesitan todas esas condiciones; cualquier falta se rechaza antes de usar Firestore. Restaurar `REMINDER_ENABLED=false` al terminar. El paso manual nunca permite envío general. Esta activación no ejecuta nuevos ensayos manuales.

| Environment Secret exacto | Contenido / finalidad |
|---|---|
| `FIREBASE_PROJECT_ID` | `sistemagestionpermanencia` |
| `FIREBASE_CLIENT_EMAIL` | Identidad privada del job, sin JSON en el runner |
| `FIREBASE_PRIVATE_KEY` | Clave privada, admite saltos reales o escapados |
| `SMTP_USER` | Dirección Gmail dedicada |
| `SMTP_APP_PASSWORD` | Contraseña de aplicación, nunca contraseña normal |
| `EMAIL_FROM` | La misma dirección que SMTP_USER, opcionalmente con nombre visible |
| `NOTIFICATION_TOKEN_SECRET` | Secreto estable de al menos 32 caracteres, compartido con la configuración previa del job |
| `REMINDER_TEST_USER_IDS` | UIDs reales de prueba separados por comas; no correos ni un arreglo JSON |

Los Secrets solo se inyectan en los pasos que ejecutan el job, y solo uno de ellos puede ejecutarse por evento. Instalación y build no los reciben. Las acciones están fijadas a SHA, checkout no persiste credenciales, las dependencias se instalan con `--ignore-scripts` y no se suben artefactos ni cachés privados. El workflow solo admite `schedule` y `workflow_dispatch` del repositorio original y `refs/heads/main`; el ejecutable repite esos controles. No admite pull requests, forks ni ramas alternativas.

Los valores no secretos del workflow son `EMAIL_PROVIDER=gmail_smtp`, `FRONTEND_URL=https://sistemagestionpermanencia.web.app`, `REMINDER_INACTIVITY_DAYS=4`, `REMINDER_MAX_ATTEMPTS=3` y `REMINDER_BATCH_SIZE=50`. No necesita Resend, Gemini, Algolia, claves del frontend ni acceso a Render.

### Cuota SMTP y resultados inciertos

`notificationJobs/gmailSmtpUsage` conserva una lista limitada de reservas dentro de una ventana móvil de 24 horas. La transacción comprueba el lease, consentimiento, actividad, rol y destinatario, reserva como máximo **20 intentos** y escribe `dispatchStartedAt` antes de invocar Nodemailer. El cupo es global para el proyecto, se comparte entre ejecuciones manuales y usuarios y no se devuelve por errores, cancelación del proceso ni resultados inciertos. `REMINDER_BATCH_SIZE` solo controla lecturas, no el cupo.

Al agotarse el cupo se difiere el recordatorio hasta la próxima liberación y se detiene el lote; esa espera no consume un intento de recuperación. El bloqueo global de 20 minutos, el lease de envío de cinco minutos y la concurrencia de Actions sin cancelación protegen las ejecuciones. El cuerpo cifrado, la fecha original y el Message-ID permanecen estables.

SMTP no tiene la idempotencia de Resend. Solo una aceptación final `250` con el único destinatario confirmado produce `accepted`; un Message-ID local no prueba aceptación ni entrega al buzón. Rechazos temporales confirmados (4xx o DNS anterior a conexión) se reintentan tras 24 horas, como máximo tres intentos dentro de 72 horas. Errores de cuenta detienen el lote. Timeouts, desconexiones o respuestas incompletas pasan a `needs_review`, también cuando el proceso cae después de `dispatchStartedAt` o Gmail acepta y falla el guardado en Firestore. No se reenvían automáticamente. Un claim sin marca de transmisión puede recuperarse al expirar el lease.

Esta política puede dejar sin entregar un correo si el proceso cae entre la marca y el envío; se prefiere esa revisión a duplicar mensajes. No existe una garantía de entrega exactamente una vez con SMTP. Revisar la carpeta Enviados de la cuenta Gmail y el Message-ID antes de resolver manualmente un resultado incierto; no borrar documentos para forzar un reenvío.

Los registros nuevos guardan `provider` y, para SMTP, `messageId` y `dispatchStartedAt`. Documentos anteriores sin proveedor se consideran Resend. Si el proveedor configurado cambia, un envío pendiente pasa a revisión y no se convierte a Gmail. Los aceptados y el historial se conservan. No se necesita migrar usuarios ni abrir reglas de Firestore.

### Resultados y costos

Actions muestra únicamente contadores (`accepted`, `deferred`, `needsReview`, `failures`, `budgetLimited`, etc.). Los fallos o registros que requieren revisión hacen terminar el ejecutable con código no cero. `accepted` no certifica entrega al buzón. En un dry run no se guardan resúmenes ni estados en Firestore; revisar su salida. En ensayos reales revisar `emailReminders/{id}`, su subcolección `attempts`, `notificationJobs/inactivity` y `notificationJobs/gmailSmtpUsage` mediante herramientas administrativas. Nunca publicar cuerpos, destinatarios, tokens, errores SMTP originales ni credenciales en logs.

El repositorio es público: los runners estándar de Actions son gratuitos. En privado, GitHub Free incluye una cuota compartida de 2.000 minutos/mes; evitar runners grandes, artefactos y almacenamiento adicional. Firestore mantiene sus cuotas y consumo del proyecto. Gmail no exige comprar un dominio, pero puede bloquear autenticación desde IPs de runners y no ofrece garantías para automatización masiva. La aplicación impone 20 intentos/24 h, por debajo de sus límites publicados; esto no impide bloqueos antispam. No hay promesa de costo cero fuera de las cuotas gratuitas.

El horario diario está incluido y se habilita al publicar esta revisión en `main`. Los candidatos se detectan en la primera vuelta tras cumplir 96 horas, normalmente dentro de las siguientes 24 horas más posibles retrasos de Actions. Los schedules pueden retrasarse, omitirse o deshabilitarse por inactividad del repositorio; no se garantiza la hora exacta ni la llegada al buzón.

Fuentes: [Gmail y Nodemailer](https://nodemailer.com/guides/using-gmail), [contraseñas de aplicación](https://support.google.com/mail/answer/185833), [límites Gmail](https://support.google.com/mail/answer/22839), [costos de Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [programación de Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

### Validación local de la ampliación Gmail

- Esta revisión pasó 102 pruebas backend y 46 de integración/reglas, incluidas validación privada, políticas schedule/manual, alias `live`, elegibilidad general y cuota bajo ese modo.
- Empaquetado y exclusión de credenciales: tres pruebas correctas.
- TypeScript comprueba backend, frontend, herramientas y los nuevos tests. Build de API, job y frontend correcto; revisión del bundle web sin secretos.
- La suite completa de interfaz terminó con 26 pruebas correctas, dos omitidas por configuración del chat y dos fallidas al recibir una página de bloqueo del Ministerio en el navegador (escritorio y móvil). El detalle interno y los eventos de las cinco comunidades se comprobaron antes del fallo externo; no se alteraron esos tests ni la integración. Las cuatro pruebas de notificaciones pasaron. El bundle de producción también renderizó sin errores en escritorio y móvil.
- El SMTP de protocolo se prueba únicamente contra `127.0.0.1`; los demás envíos usan adaptadores simulados. No se ejecuta el job contra producción, ni un dry run de producción, ni una conexión a Gmail.

El emulador imprime rechazos PERMISSION_DENIED esperados y una advertencia de metadatos sin afectar las pruebas. Las pruebas de concurrencia tienen un timeout acotado para permitir el backoff transaccional del SDK, sin introducir pausas artificiales. El build de Vite requiere permisos locales de lectura fuera del sandbox; no implica despliegue. El dry run remoto fue exitoso; la entrega real se comprobará en las ejecuciones programadas naturales, sin lanzar envíos manuales adicionales.

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
- `accepted`: el proveedor confirmó aceptación; no garantiza entrega al buzón. Resend devuelve un identificador; SMTP confirma la respuesta final del servidor.
- `retryable`: rechazo transitorio confirmado (por ejemplo 429); espera `nextAttemptAt`.
- `uncertain`: resultado de Resend no confirmado, recuperable con la misma clave dentro de su ventana. SMTP incierto pasa directamente a revisión.
- `failed_permanent`: rechazo definitivo del proveedor.
- `needs_review`: resultado incierto fuera de la ventana, intentos agotados o copia que no puede verificarse.
- `skipped`: cambió consentimiento, actividad o correo antes del envío.

Se usa transacción Firestore para reclamar y un `leaseId` para impedir que un worker anterior sobrescriba el resultado de otro. Resend conserva sus esperas de 15 y 60 minutos y una ventana de 23 horas; no debe recuperarse con un cron de una sola ejecución diaria. Gmail utiliza la política de 24/72 horas descrita arriba y nunca reintenta resultados inciertos.

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

## Variables de la alternativa Resend/Render (compatibilidad)

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

## Alternativa histórica Resend/Render: no ejecutar para Gmail

Los pasos de esta sección describen la entrega anterior y la opción de Cron de pago. No son necesarios para la ampliación Gmail/Actions, que no requiere volver a publicar frontend ni reglas. No importar `deploy/render-reminders.yaml` para el ensayo gratuito. Las configuraciones existentes de Render permanecen intactas.

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

Para filtrar E2E puede usarse `$env:VC_E2E_GREP='notificaciones'; bun run test:e2e`. Los tests sustituyen los proveedores externos y usan un SMTP exclusivamente local; nunca se envía correo real. Las nuevas pruebas cubren reserva concurrente del último cupo, límite persistido, fallos SMTP, caídas después de iniciar transmisión, recuperación diaria, registros legacy, aislamiento y política del workflow. TypeScript también comprueba los nuevos tests mediante `tsconfig.tools.json`. La autenticación y entregabilidad reales de Gmail/Resend requieren una autorización posterior.

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

La lista anterior corresponde a la entrega original de Etapa 1. La ampliación actual añade los adaptadores de transporte, `workflow-policy.ts`, el workflow manual y las pruebas SMTP/workflow; modifica configuración, tipos, cola, job, tests, ejemplos vacíos y esta documentación. Se añade únicamente Nodemailer 10.2.1 con tipos incluidos y se actualiza `Backend/bun.lock`. Sin cambios en datos reales, índices Algolia, mapa, proveedores Gemini/MinEnergía/CREG/XM, Dockerfile, Hosting ni `.env` privados.

## Evidencia histórica de la entrega original Resend

- TypeScript de backend, frontend y herramientas: correcto.
- Backend: 88 pruebas correctas, incluidos controles del transporte y modo seco.
- Integración con Firestore Emulator y reglas: 25 pruebas correctas (13 de notificaciones y 12 de seguridad).
- Interfaz: cuatro pruebas correctas entre escritorio y móvil; incluyen registro con/sin consentimiento, perfil, fallo del API, retorno tras login y baja pública que exige confirmación. Capturas locales de la baja en `artifacts/notifications-unsubscribe-*.png`.
- Empaquetado/credenciales excluidas: tres pruebas correctas.
- Build de API, Cron y frontend: correcto; revisión de secretos del bundle sin filtraciones detectadas.
- API compilada: inicia en modo producción y rechaza acceso anónimo a las nuevas rutas protegidas. Job compilado con envío desactivado: cero candidatos procesados y cero correos aceptados.

Los rechazos PERMISSION_DENIED de las pruebas de reglas son los esperados. El SDK mostró una advertencia de metadatos durante el emulador, sin fallos de pruebas. No se ejecutó envío real a Resend, publicación de estas reglas, creación de Cron de pago ni validación de esta revisión en los dominios publicados. Esos pasos permanecen manuales.
