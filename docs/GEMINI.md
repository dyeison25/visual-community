# Chat con Google Gemini

Proveedor activo: **Google Gemini**, únicamente desde el backend. Implementado sobre el chat existente, sin cambios en Firebase, Firestore, roles, colecciones, mapa, fuentes o eventos. Se deja preparado **sin completar la activación real**, según lo solicitado. Durante la comprobación apareció un valor local en GEMINI_API_KEY y el backend devolvió un error de configuración/acceso; no se imprimió, sustituyó ni borró ese valor. No se obtuvo una respuesta generada con Google y se detuvieron las pruebas contra el proveedor.

## Activarlo

1. Crea una clave en [Google AI Studio](https://aistudio.google.com/apikey). La clave web de Firebase no sirve como sustituto.
2. Comprueba que el proyecto y el modelo tengan cuota disponible en el nivel gratuito. Google ofrece gratuidad limitada, no uso ilimitado; una clave de un proyecto con facturación puede generar cargos. Esta integración no activa facturación ni cambia tu plan. Consulta [precios](https://ai.google.dev/gemini-api/docs/pricing) y [cuotas](https://ai.google.dev/gemini-api/docs/rate-limits).
3. En **Backend/.env**, completa únicamente la clave; el modelo ya está preparado:
   ```dotenv
   GEMINI_API_KEY=
   GEMINI_MODEL=gemini-3.6-flash
   ```
   El valor vacío debe sustituirse localmente por tu clave. No la pongas en `.env.example`, React, variables VITE, capturas o mensajes. El modelo se puede cambiar por uno de texto compatible y disponible en tu proyecto.
4. Reinicia el backend: detén su terminal con Ctrl+C y ejecuta `bun run --cwd Backend dev` desde la raíz. Si administras frontend/backend juntos, detén esa instancia y ejecuta `npm run dev`. Evita dos servidores en el mismo puerto.
5. Inicia sesión en http://localhost:5173 y abre **Asistente**. Pregunta “¿Qué es una comunidad energética?”. Debes recibir una respuesta y fuentes oficiales.
6. Comprueba también La Guajira, normativa, demanda y el seguimiento Antioquia → Medellín.

El chatbot utiliza exclusivamente Gemini. El adaptador anterior y su dependencia OpenAI fueron retirados en octubre de 2026. No existe respaldo automático hacia ese proveedor. La recomendación histórica de revocar una clave expuesta sigue vigente.

## Funcionamiento

`ChatWidget → POST /api/chat → chatService → retrievalService → geminiService → Google Gemini`.

- SDK oficial **@google/genai 2.23.0**, método `models.generateContent`.
- El SDK usa la API Gemini Developer; no Vertex AI ni credenciales web de Firebase.
- La ruta interna sigue protegida con el ID token de Firebase.
- Recuperación primero con Algolia; si no está configurado o no encuentra contexto, consulta el catálogo real de MinEnergía, CREG y XM.
- Hasta cinco fuentes, con selección territorial y preferencias; XM se actualiza antes de responder.
- Las instrucciones comunes en `chatPrompt.ts` exigen responder con hechos del contexto, citar fuentes y reconocer información insuficiente.
- El historial se limita a cuatro mensajes. El rol interno assistant se convierte a model, como espera Gemini.
- Sin fuentes, se devuelve el mensaje de información insuficiente sin generar texto con el proveedor. Con la instalación sin clave, se muestra primero el estado de configuración pendiente.
- Las fuentes enlazadas provienen de la plataforma, no de URLs inventadas por Gemini.

## Límites y errores

Pregunta: 1.200 caracteres. Historial: cuatro mensajes de hasta 1.200 caracteres. Respuesta: hasta 1.000 tokens. Timeout: 45 segundos. Una solicitud simultánea y seis/minuto por uid. No hay llamadas automáticas al abrir páginas ni reintentos del SDK.

En los modelos `gemini-2.5-flash` y `gemini-2.5-flash-lite`, se desactiva el razonamiento adicional para dedicar el límite a la respuesta. Otros modelos conservan su configuración de razonamiento; deben comprobarse sus requisitos y cuotas antes de elegirlos.

Se manejan clave/modelo ausentes, errores 400/401/403/404 de configuración, cuota o límite 429, red, timeout y error del proveedor. Las respuestas vacías, truncadas o bloqueadas no se muestran como completas. No se exponen mensajes privados del SDK, claves ni stack traces.

## Privacidad y eventos

Google recibe pregunta, historial acotado y contexto público. No recibe uid, nombre, correo ni eventos del perfil. El usuario podría incluir datos personales en lo que escribe: la interfaz le pide evitarlos.

El nivel gratuito de Gemini puede utilizar las entradas y respuestas para mejorar productos de Google; la interfaz y la página de privacidad lo indican. No se aplica el parámetro `store:false` de OpenAI a Gemini ni se promete retención cero en el proveedor. [Condiciones de Google](https://ai.google.dev/gemini-api/terms).

La conversación sigue solo en memoria del navegador; no se guarda completa en Firestore. Se mantienen CHAT_OPEN, CHAT_QUERY, CHAT_RESPONSE, CHAT_SOURCE_CLICK y CLICK_EXTERNAL_SOURCE, asociados al uid. La analítica continúa reservada a administración.

## Comprobar sin clave

```powershell
npm run typecheck
npm test
npm run build
node scripts/check-client-secrets.mjs
Push-Location Backend
bun scripts/check-chat.ts
Pop-Location
```

El último comando comprueba recuperación real de fuentes, sin generar respuestas. Para comprobar generación después de configurar una clave, ejecutar desde Backend `bun scripts/check-chat.ts --live`: envía cuatro consultas y consume la cuota correspondiente. Sin clave, se detiene antes de llamar al proveedor.

Pruebas del navegador con la plataforma real iniciada y Gemini sin clave:

```powershell
Remove-Item Env:\DEBUG -ErrorAction SilentlyContinue
$env:VC_E2E_REAL='true'
npm run test:e2e:running -- --grep 'Gemini sin clave|contrato de búsqueda y conversación'
```

Crean y eliminan cuentas temporales en Firebase. Las respuestas del test de conversación y el error de configuración son dobles explícitos, solo de prueba. La ausencia real de clave/modelo y la serialización del SDK se comprueban en las pruebas del backend sin tráfico a Google.

## Archivos

Creados: `Backend/src/services/chat/geminiService.ts`, `chatPrompt.ts`, `Backend/tests/gemini.test.ts` y esta guía.

Modificados: `chatService.ts`, `openaiService.ts`, comentario de `retrievalService.ts` y `chat.routes.ts`; `Backend/scripts/check-chat.ts`; `Backend/package.json` y `bun.lock`; `Backend/.env` y `.env.example`; `ChatWidget.tsx`, `PrivacyPage.tsx`; `tests/e2e/platform.spec.ts`; `scripts/check-client-secrets.mjs`; README principal, Backend/README y las guías anteriores para señalar el cambio de proveedor.

No se instalaron paquetes en el frontend ni se modificaron reglas de Firestore.

## Estado de pruebas

- `npm run typecheck`: correcto en backend y frontend.
- `npm test`: **58 pruebas aprobadas**, ocho específicas de Gemini. Incluyen SDK real con transporte simulado, contexto, roles, límites, errores 400/401/403/404/429/500, red, timeout, respuesta vacía/truncada/bloqueada y ausencia de reintentos.
- Navegador: **cuatro casos aprobados** entre escritorio y móvil, en ejecuciones dirigidas. Conversación, fuentes, error visible, dimensiones del panel, navegación y eventos en Firestore real. Las cuentas temporales se eliminaron después.
- Las dos comprobaciones iniciales que asumían clave ausente encontraron configuración local y fallaron por recibir un error de acceso; se aislaron para no consumir cuota ni depender de valores locales. No se presenta ese error como una generación exitosa.
- Recuperación real: las cuatro preguntas de la guía y Antioquia → Medellín obtuvieron contexto oficial, sin invocar generación.
- `npm run build`: correcto.
- `node scripts/check-client-secrets.mjs`: diez archivos revisados, ninguna filtración y claves vacías en el ejemplo.
- Gemini es el único proveedor de generación activo; la integración anterior se retiró.

La prueba real de generación queda pendiente de revisar la clave, acceso al modelo y cuota cuando el usuario decida activarla. La limitación externa del sitio web del Ministerio, documentada en la etapa anterior, no se modifica con este cambio.

## Diagnóstico real del 22 de septiembre de 2026

Se revisó exclusivamente el recorrido del chat:
`ChatWidget → discoveryService.chat → POST /api/chat → chatRoutes → chatService → geminiService → models.generateContent`.

La disponibilidad depende únicamente de GEMINI_API_KEY y GEMINI_MODEL. El adaptador anterior OpenAI no participa. Vite envía /api al backend en 127.0.0.1:3000.

Prueba mínima real con “¿Qué es una comunidad energética?”:

- Modelo original: gemini-2.5-flash.
- HTTP 404; estado NOT_FOUND.
- Mensaje original de Google: “This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash for the latest features and improvements. We recommend you to use the Interactions API.”

Causa: modelo no disponible para usuarios nuevos; no era una validación de OpenAI ni una ruta incorrecta. El catch de geminiService.ts agrupaba 400/401/403/404 en el mismo mensaje público sin registrar el diagnóstico original.

Cambios:

- GEMINI_MODEL actualizado a gemini-3.6-flash en Backend/.env y .env.example. No se modificó la clave.
- geminiDiagnostic.ts registra HTTP, código, estado, motivo cuando existe, mensaje original y modelo antes de traducir el error para la UI. Oculta claves y evita registrar el objeto completo, cabeceras o stack.
- Gemini 3.6 Flash usa razonamiento MINIMAL; timeout 45 segundos. No hay reintentos automáticos.
- diagnose-gemini.ts reproduce la petición mínima desde Backend:
  ```powershell
  bun scripts/diagnose-gemini.ts
  ```

Las pruebas con 3.6 recibieron errores del proveedor: primero cancelación con el timeout anterior; después HTTP 503 UNAVAILABLE (“This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.”) y HTTP 504 DEADLINE_EXCEEDED (“Deadline expired before operation could complete.”).

**No se obtuvo una respuesta real exitosa en esta revisión.** Hay que repetir la prueba cuando se recupere el servicio; no se interpreta una variable cargada como prueba de que Google generó una respuesta.

Validación: 62 pruebas aprobadas y tipos correctos en frontend/backend. Los tests cubren que el error original se registre antes del mensaje público y que no se filtren claves.

Referencia oficial del modelo y sintaxis de generateContent: https://ai.google.dev/gemini-api/docs/generate-content/latest-model?hl=es-419
