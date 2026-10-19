# Informe de limpieza y preparación del lanzamiento

Fecha: 19 de octubre de 2026.

**Resultado: limpieza incremental y configuración de producción preparadas; publicación pendiente.** El propietario indicó expresamente: «Preparar todo; falta habilitar el alojamiento». No se contrataron recursos ni se publicó una versión parcial. No hay URL pública del frontend ni de la API confirmada.

## 1. Eliminaciones verificadas

Archivo eliminado: `Backend/src/services/chat/openaiService.ts`. El endpoint de chat ya utilizaba Gemini; solo las pruebas del adaptador antiguo lo importaban. Se retiraron seis pruebas exclusivas de ese proveedor y se conservaron las pruebas compartidas de contexto, recuperación, fuentes y validación, además de toda la cobertura de Gemini.

Código retirado: imports `Loading` y `ChevronDown` sin uso; parámetro `layer` y su argumento redundante en `parseCommunities`; auxiliar no invocado `clearAdminCache`; constante exportada `INTERESTS` sin consumidores. El campo legacy `interests`, sus valores y compatibilidad con perfiles existentes se conservan.

Dependencias directas retiradas: `openai`, `jsonwebtoken`, `socket-io`. Se actualizó `Backend/bun.lock` con Bun y se verificó instalación congelada. `jsonwebtoken` permanece donde Firebase Admin lo necesita transitivamente. TypeScript pasa de peerDependency a devDependency del backend, conservando su versión; no se elimina la herramienta de compilación.

Configuración retirada: entrada obsoleta de Prisma en Backend/.gitignore y documentación activa que describía Redis, proveedores retirados o estado de configuración antiguo. No se modificaron Backend/.env, Frontend/.env ni la cuenta de servicio. Las variables actuales de esos archivos tienen uso; no se eliminaron por apariencia. Los nombres de proveedores retirados pueden permanecer en detectores de secretos y documentos históricos, sin activar una integración.

La matriz previa con evidencia y riesgo está en [AUDITORIA_PRODUCCION.md](AUDITORIA_PRODUCCION.md). El análisis de TypeScript revisó imports, reexports y cargas dinámicas; no identificó componentes React huérfanos ni imports locales rotos. El mapa usa importación diferida y se conserva. La búsqueda de exportados fue contrastada manualmente para evitar falsos positivos.

## 2. Elementos conservados deliberadamente

- Rutas de compatibilidad `/api/profile/metrics` y respuestas 410 de autenticación antigua: están montadas y cubiertas por pruebas de seguridad.
- Herramientas de preparación, diagnóstico e indexación: son entradas manuales, no código muerto por no importarse desde app.ts.
- Pruebas, fixtures y emuladores: siguen verificando fallos y aislamiento; no se incluyen en la imagen pública.
- Documentación histórica, capturas, respaldos y artifacts: conservan utilidad académica y de recuperación. Se excluyen del despliegue.
- Carpetas vacías de nombres incompletos encontradas en la raíz: se conservaron en la primera limpieza. En la revisión estructural posterior solicitada por el propietario se eliminaron tras comprobar nuevamente que estaban vacías y sin uso; véase [ESTRUCTURA_Y_DUPLICADOS.md](ESTRUCTURA_Y_DUPLICADOS.md).

No existía `.git` en esta copia. Se creó un respaldo no secreto antes de las modificaciones en `%TEMP%/visual-community-preproduccion-20261019/codigo-antes.zip`, con manifiesto de hashes. Los archivos privados no se copiaron a ese respaldo. El inventario de cambios está en `artifacts/produccion-cambios.json`.

## 3. Cambios para producción

- Build del backend para Bun en `Backend/dist/index.js`; comando de arranque del artefacto compilado.
- Build conjunto de frontend/backend y comprobación de secretos en el bundle web.
- Validación al iniciar: variables obligatorias, proyecto Firebase real y prohibición de emuladores en producción.
- CORS con orígenes exactos; HTTPS obligatorio en producción. Caché privada deshabilitada para respuestas de API y error 413 controlado para cuerpos excesivos.
- Puerto de plataforma, escucha de producción en 0.0.0.0 y cierre por SIGTERM/SIGINT con plazo acotado.
- Dockerfile con Bun 1.3.13, etapas separadas, usuario sin privilegios y dependencias de ejecución. Listas permitidas en `.dockerignore` y `.gcloudignore` para excluir credenciales y artefactos.
- Firebase Hosting: rutas SPA, HTTPS administrado, cabeceras básicas, revalidación de HTML y caché de assets con hash.
- Build de lanzamiento de Vite: exige Firebase público, API HTTPS y ausencia de variables privadas o emuladores.
- Scripts `deploy/backend.ps1` y `deploy/frontend.ps1`: Secret Manager, identidad de servicio y sitio Hosting explícito. La publicación web solo despliega Hosting, nunca reglas/índices.
- Suite posterior específica `playwright.production.config.ts` y `tests/production/launch.spec.ts`, compatible con el bundle publicado y sin imports del código fuente en el navegador.
- Análisis de no utilizados habilitado en TypeScript y comprobación adicional de tipos para las herramientas nuevas.

Plataforma preparada: Firebase Hosting para la web y Google Cloud Run para la API. No está desplegada todavía. La web llamará directamente a la API por HTTPS; se evita el timeout de 60 segundos de Hosting para reescrituras hacia servicios dinámicos.

## 4. Variables necesarias, sin valores

Servidor: `NODE_ENV`, `HOST`, `PORT`, `FIREBASE_PROJECT_ID`, `FRONTEND_ORIGIN`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ALGOLIA_APP_ID`, `ALGOLIA_SEARCH_API_KEY`, `ALGOLIA_INDEX_NAME`.

Herramienta de indexación, fuera del contenedor público: `ALGOLIA_ADMIN_API_KEY`.

Frontend público: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_API_BASE_URL`. Opcionales: `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`.

Opcionales de fuentes: `MINENERGIA_LAYER_URL`, `XM_API_URL`, `EXTERNAL_TIMEOUT_MS`. Desarrollo y pruebas: `GOOGLE_APPLICATION_CREDENTIALS`, `VITE_USE_FIREBASE_EMULATORS`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `VITE_DEV_PORT`, `API_PROXY_TARGET`, `VC_E2E_GREP`, `VC_E2E_CHAT_CONFIGURED`. Lanzamiento: `VC_RELEASE_BUILD`; pruebas públicas: `VC_PUBLIC_FRONTEND_URL`, `VC_PUBLIC_API_URL`, `VC_SMOKE_CREATE_TEST_ACCOUNTS`.

En Cloud Run se usa identidad de servicio, no el JSON privado local. Los dominios autorizados de Firebase Authentication se añadirán cuando se conozca el sitio público, conservando los existentes.

## 5. Pruebas realizadas

| Comprobación | Resultado y alcance |
|---|---|
| Línea base | TypeScript correcto; 71 pruebas backend correctas. |
| Después de retirar OpenAI | 65 pruebas correctas; diferencia de seis pruebas del proveedor retirado, no pérdida de cobertura Gemini. |
| Suite final de backend | 69 correctas, 0 fallos; incluye cuatro verificaciones nuevas de producción/CORS/errores. |
| TypeScript | Frontend, backend y herramientas nuevas correctos; imports sin roturas. |
| Reglas Firestore | 11 pruebas correctas en emuladores: uid, preferencias, roles, eventos y métricas. |
| Reglas reales | Coinciden con el archivo local; verificación solo de lectura. |
| Build | Backend y frontend correctos. El escáner revisó diez archivos web sin detectar secretos ni claves en ejemplos. |
| Artefacto compilado API | Arranca con NODE_ENV=production; salud disponible y rutas de datos rechazan acceso anónimo. Sin llamadas externas en esa prueba. |
| UI compilada | Navegador real: /admin redirige a login sin sesión; registro visible; ancho móvil correcto; cero errores JavaScript. |
| E2E completa inicial | 20 correctas, 4 fallidas, 2 omitidas. Dos fallos debidos a una suposición antigua sobre ausencia de claves; dos por bloqueo externo del portal del Ministerio. |
| E2E focalizadas tras corrección | 6 correctas en escritorio/móvil: mapa, recomendaciones, fallos simulados, búsqueda/chat y chat real sin contexto con eventos. Incluye los dos escenarios previamente omitidos. |
| Balance de escenarios E2E | 24 escenarios distintos verificados entre ambas ejecuciones. Permanecen dos fallos externos del Ministerio; no se afirma que toda la suite esté verde en una sola ejecución. |
| Scripts de despliegue | Análisis sintáctico PowerShell correcto. No se ejecutaron publicaciones remotas. |
| Imagen Docker local | Construida con Bun 1.3.13 y lockfile congelado. API operativa en modo producción, usuario sin privilegios, seis rutas protegidas, CORS y cierre SIGTERM correctos. Prueba sin red externa, sin credenciales reales ni volúmenes. |
| Pruebas sobre URLs públicas | No ejecutadas: no hay despliegue público habilitado. |

La prueba antigua de “servicios sin claves” se corrigió para simular explícitamente ese fallo dentro de la prueba. La configuración real de Algolia no se borró ni deshabilitó. La prueba del bloqueo del Ministerio se conserva estricta y no se debilitó para ocultar el fallo.

Las E2E comprobaron registro, correo inválido, cuenta existente, login correcto/incorrecto, onboarding, persistencia, logout, perfil, preferencias, roles y revocación, privacidad entre cuentas, actividad administrativa, eventos, mapa, contenidos, normativa, XM y degradación frente a fallos. Las cuentas utilizadas por esta suite son del emulador.

## 6. Integraciones reales verificadas

El diagnóstico de proveedores efectuó cero escrituras de datos o índices. Se comprobó lectura de Authentication y una muestra mínima de Firestore, sin mostrar información personal.

| Integración | Resultado observado |
|---|---|
| Firebase Authentication | Lectura administrativa disponible. Los flujos interactivos se probaron en emuladores, no se certifica aún el dominio público. |
| Firestore | Lectura correcta y reglas remotas iguales a las locales. |
| MinEnergía | 24 registros en la consulta paginada y 17.499 registros con coordenadas en el mapa. |
| XM | Generación, demanda y precio de bolsa disponibles; último día completo observado: 16 de octubre de 2026. |
| CREG | Tres documentos oficiales del catálogo editorial; no es una API dinámica. |
| Algolia | Doce resultados recuperados y ordenación con motivos de recomendación. No se indexó ni modificó configuración. |
| Gemini | Una respuesta real generada con fuentes recuperadas. No se registra aquí el texto de la conversación ni credenciales. |

Evidencia local: `artifacts/produccion-integraciones.json`, `artifacts/produccion-unitarias.log`, `artifacts/produccion-e2e.log`, `artifacts/produccion-e2e-revision.log` y `artifacts/produccion-contenedor.json`. Estas evidencias no se envían al hosting.

En la continuación de la preparación local se añadieron `scripts/verify-container.ps1` y `scripts/verify-container.mjs`. Construyen y verifican la imagen, comprueban que no incluya el código fuente, herramientas, TypeScript ni archivos privados del proyecto y eliminan exclusivamente el contenedor temporal creado por la prueba. La imagen local queda disponible como `visual-community-api:local-check`. Docker Desktop se inició para esta comprobación; no se habilitó alojamiento. No hubo nuevas eliminaciones, cambios de dependencias ni modificaciones funcionales en esta continuación.

## 7. Pendientes y límites

1. Habilitar facturación, alojamiento y permisos. Confirmar sitio Hosting, identidad de ejecución y secretos; luego ejecutar el procedimiento de [PRODUCCION.md](PRODUCCION.md).
2. Construir la imagen en Cloud Build y verificarla en Cloud Run, publicar web, completar dominios autorizados y ejecutar la suite pública. La imagen local ya fue verificada; falta comprobar identidad de servicio, secretos y conectividad reales del entorno remoto. Las URLs frontend/API siguen pendientes.
3. MinEnergía responde al backend, pero su página institucional devuelve “URL Bloqueada” al navegador automatizado en este entorno. Falló la comprobación de cinco enlaces en escritorio y móvil. El detalle interno y los datos siguen funcionando. Revalidar desde la red y dominio de lanzamiento; no prometer acceso universal a una página de terceros.
4. Los límites por usuario y las cachés son de proceso. La configuración inicial limita instancias; para escalar o tener cuotas globales estrictas se necesita un limitador compartido. Los reinicios y revisiones reinician estos contadores.
5. En Windows el emulador Firestore dejó un proceso Java después del cierre de Firebase CLI. Se identificaron y cerraron exclusivamente los procesos de estas pruebas. No es un fallo del servidor productivo, pero puede ocupar el puerto 8080 en nuevas verificaciones.
6. No hay historial Git en esta copia. Existe respaldo local, pero conviene incorporar control de versiones antes del primer lanzamiento.

No se han implementado clasificación de abandono, campañas ni incentivos. Tampoco se ha cambiado el alcance funcional de la aplicación durante esta limpieza. No se eliminaron datos reales ni se modificaron las reglas o índices existentes.
