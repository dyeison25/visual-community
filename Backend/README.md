# Backend de Visual Community

API Express 5 ejecutada con Bun. Conserva rutas, controladores, servicios separados y modelos compartidos en ../shared.

Firebase Admin valida los ID tokens de Firebase Authentication. Registro y login suceden en el frontend mediante Firebase; las antiguas rutas POST responden 410. Las rutas administrativas comprueban el rol antes de entregar datos.

## Ejecutar desde esta carpeta

```powershell
bun install --frozen-lockfile
bun run dev
bun run typecheck
bun run build
bun run start
```

Configura .env siguiendo .env.example. La API pública actual está en Render: https://visual-community-api.onrender.com. En local se admite la cuenta privada existente; en Render usa las variables privadas descritas abajo. No publiques el archivo privado.

Firebase Admin se inicializa en `src/config/firebase.config.ts`, una sola vez, con esta prioridad:

1. `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`, si las tres están completas. La clave admite saltos de línea reales o `\n` escapados.
2. Archivo existente indicado por `GOOGLE_APPLICATION_CREDENTIALS`.
3. Archivo local `firebase-service-account.json`, relativo al directorio de ejecución (normalmente Backend).
4. `applicationDefault()` para la identidad del servidor, como Cloud Run.

En Render configura las tres variables del primer paso como variables privadas del servicio backend. No configures rutas a archivos de tu computadora, no uses prefijos VITE y no copies el JSON a Docker. Conserva también las variables habituales de la API, CORS, Gemini y Algolia. Reinicia o redespliega el backend después de guardar la configuración. Las credenciales inválidas no se ocultan usando otra identidad; se rechazan con un mensaje sin secretos. Si el conjunto de tres variables está incompleto, se siguen los fallbacks anteriores. Los emuladores conservan su tratamiento separado, solo en desarrollo con proyecto demo.

## Servicios

MinEnergía: lista y mapa ArcGIS, enlaces públicos validados. CREG: catálogo de documentos oficiales. XM: generación, demanda y precio de bolsa. Algolia: búsqueda, candidatos y enriquecimiento del perfil. Gemini: único proveedor del chat, con modelo configurable. Administración: métricas e historial con acceso restringido.

La clave Algolia Admin se utiliza solo en indexación y no debe configurarse en el contenedor público. Las recomendaciones usan la clave de búsqueda.

## Herramientas

bun run verify:integrations --map --gemini comprueba servicios reales sin escribir documentos ni índices; --gemini consume una generación.

bun scripts/index-content.ts --dry-run revisa el catálogo sin publicarlo. Los scripts de preparación de perfiles y publicación de reglas son herramientas administrativas; no se ejecutan durante el arranque ni el despliegue.

Ver [producción](../docs/PRODUCCION.md), [personalización](../docs/PERSONALIZACION_ALGOLIA.md) y [auditoría](../docs/AUDITORIA_PRODUCCION.md).

## Recordatorios de inactividad — Etapa 1

Ver [guía completa](../docs/NOTIFICACIONES_CORREO.md). `bun run build` también compila el job. `bun run reminders` lo ejecuta desde esta carpeta; por defecto está desactivado y en simulación. No debe habilitarse para todos los usuarios sin revisar los ensayos.

Nuevas rutas: `POST /api/activity` y `POST /api/notifications/consent` requieren el ID token. `POST /api/notifications/unsubscribe` es público, limitado por IP y exige token opaco más `confirm: true`; ningún GET realiza una baja. El uid del consentimiento y la actividad siempre procede de la sesión verificada.

El job usa la API REST oficial de Resend desde backend, con copia cifrada de la solicitud e idempotencia de 23 horas (el proveedor conserva claves 24 horas). Los estados ambiguos fuera de esa ventana quedan en `needs_review`; no se genera automáticamente otra clave. No se añadieron dependencias. Las pruebas de correo sustituyen el transporte solo en las pruebas y no envían mensajes reales.
