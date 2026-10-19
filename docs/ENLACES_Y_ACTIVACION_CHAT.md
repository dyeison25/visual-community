# Enlaces oficiales y activación del chatbot

**Cambio posterior de proveedor:** el chat activo utiliza ahora Google Gemini y está preparado sin clave. Sigue [la guía de Gemini](GEMINI.md). Los apartados de OpenAI de este documento describen la etapa anterior; ya no es necesario habilitar saldo de OpenAI para usar el chat.

Revisión: 21 de septiembre de 2026. Cambios incrementales sobre React/Vite, Express/Bun y Firebase existentes. Sin migraciones, cambios de roles, reglas abiertas ni borrado de eventos. No se instalaron dependencias nuevas.

## Causa y solución de los enlaces

La URL `https://www.minenergia.gov.co/es/comunidades-energeticas/` estaba fijada manualmente como enlace institucional para todas las comunidades; no provenía de un campo de ArcGIS. Respondió HTTP 404 durante la revisión, aunque todavía aparece en buscadores y enlaces del propio Ministerio.

Se consultó el esquema oficial de:
`https://arcgisenterprise.minenergia.gov.co/server/rest/services/Comunidades_Energ%C3%A9ticas/MapServer/0?f=json`.

La capa no publica campos de URL, página, ficha o documento individual verificable. FID e ID identifican registros geográficos, pero no acreditan una ruta web pública. No construimos enlaces a partir de esos identificadores o del nombre.

El respaldo temático es [la publicación oficial que presenta la estrategia de comunidades energéticas](https://www.minenergia.gov.co/es/sala-de-prensa/noticias-index/minenerg%C3%ADa-hace-el-lanzamiento-de-comunidades-energ%C3%A9ticas-una-iniciativa-para-democratizar-la-energ%C3%ADa/). Es una publicación del 15 de noviembre de 2023, no una ficha individual, ni una convocatoria actual, ni un nuevo micrositio general. No se pudo verificar un reemplazo vigente del micrositio roto.

Orden de resolución:

1. URL específica, cuando se disponga de una URL oficial fiable. La capa actual no la proporciona.
2. Publicación temática oficial indicada arriba.
3. `https://www.minenergia.gov.co/es/misional/energia-electrica-2/`.
4. `https://www.minenergia.gov.co/es/`.
5. Si ninguna responde como página pública válida, no se abre una fuente fallida; se conserva el detalle interno y se muestra un mensaje.

`shared/officialSources.ts` centraliza los enlaces. `public-links.service.ts` verifica HTTPS, dominio del Ministerio, respuestas HTTP, tipo HTML/PDF y redirecciones dentro del mismo dominio. Rechaza JSON, REST, FeatureServer, MapServer, la ruta retirada, páginas de “contenido no encontrado” y bloqueos conocidos. Timeout de cinco segundos por candidato y caché de cinco minutos. Esta comprobación no extrae contenidos ni incorpora HTML al catálogo.

`GET /api/energy/ministry-source?url=...` requiere sesión y devuelve un enlace verificado o null. `SourceLink` lo consulta antes de navegar. También corrige el enlace antiguo que pueda permanecer en resultados ya indexados de Algolia. “Ver información” sigue abriendo el detalle interno con coordenadas, municipio, departamento y demás campos públicos.

Los recursos editoriales del manual y del registro apuntan ahora al [Manual de gestión de 2025](https://www.minenergia.gov.co/documents/14860/Manual-Gestion-Comunidades-Energeticas-2025.pdf), que contiene esas materias. Son resúmenes editoriales, no un feed ni una consulta al documento completo por el chatbot.

### Limitación externa observada

Las páginas alternativas respondieron HTTP 200 con contenido institucional a las comprobaciones del servidor. Sin embargo, Edge automatizado recibió HTTP 500 y “URL Bloqueada / Pagina WEB Bloqueda!” del sistema de seguridad del Ministerio, incluso en otras páginas del portal. Esto impide certificar la navegación externa exitosa desde este entorno. No se intentó evadir el bloqueo.

Una validación del backend no puede garantizar qué responderá el Ministerio a cada navegador/IP. Las pruebas conservan este fallo visible. Hay que repetir la comprobación externa en un navegador permitido cuando el Ministerio deje de bloquear esas peticiones. No se promete disponibilidad permanente de un sitio ajeno.

## Chatbot

La interfaz conserva el botón flotante, panel, historial, input, enviar, cerrar y nueva conversación. Añade desplazamiento al último mensaje y reutiliza la verificación de enlaces oficiales en las fuentes del asistente. Bloquea solicitudes duplicadas y muestra carga y errores comprensibles.

Ruta protegida: `POST /api/chat`.

Flujo: interfaz → backend → perfil de intereses → Algolia → selección de hasta cinco fuentes → OpenAI Responses API → texto y fuentes.

Si Algolia no está configurado, falla o no aporta contexto pertinente, se usa el catálogo real de los servicios existentes: capa completa de comunidades, resúmenes institucionales, selección CREG y métricas XM. Se filtra por departamento y municipio conocidos; una pregunta de seguimiento utiliza el tema anterior. Las métricas XM se vuelven a consultar antes de responder. No se envía todo el catálogo a OpenAI.

“Recomiéndame según mis preferencias” usa la afinidad ya calculada con preferencias y eventos, con una explicación del orden. No se envían nombre, correo, uid ni el historial de seguimiento a OpenAI.

No tener resultados produce:
> No encontré información suficiente en las fuentes disponibles para responder con precisión.

En ese caso no se llama a OpenAI. Los textos recuperados son contexto, no instrucciones. El asistente no inventa datos, listas ni distancias y debe citar las fuentes numeradas. Las fuentes visibles proceden del catálogo, no de URLs generadas por el modelo.

SDK oficial instalado: **openai 7.20.0**. Método `responses.create`, `store:false`, timeout 20 segundos, sin reintentos automáticos. `OPENAI_MODEL` es obligatorio y no tiene un valor fijado en código. Preguntas de hasta 1.200 caracteres; cuatro mensajes previos; cinco fuentes; salida máxima de 1.000 tokens; seis solicitudes/minuto y una en curso por uid. El historial visible permanece solo en memoria del navegador.

Se conservan eventos CHAT_OPEN, CHAT_QUERY, CHAT_RESPONSE, CHAT_SOURCE_CLICK. Abrir una fuente registra además CLICK_EXTERNAL_SOURCE. Todos quedan relacionados con el uid y timestamp del servidor en `profiles/{uid}/interactions`. Se conserva el identificador de fuente existente `MinEnergía`; no se introduce otra variante que divida las métricas. No se guardan conversaciones completas ni preguntas textuales en Firestore.

## Estado real de OpenAI y paso manual necesario

Las variables se habían escrito en `Backend/.env.example`. Se trasladaron a `Backend/.env`, sin sobrescribir valores privados existentes, y se dejaron vacías en el ejemplo. El servidor no utiliza el archivo de ejemplo como configuración.

**La clave que se incluyó en el ejemplo quedó expuesta durante la inspección. Revócala y genera otra.** No la copies a documentación, mensajes, archivos de ejemplo ni variables VITE.

La comprobación del modelo configurado `gpt-5.6-luna` respondió correctamente. La prueba real de generación fue rechazada por OpenAI: **HTTP 429, `credit_balance_exhausted`, `insufficient_quota`**. No se obtuvo una respuesta generada. El chatbot no puede considerarse activado hasta resolver ese saldo y repetir las pruebas reales.

1. Revoca la clave anterior y crea otra en tu cuenta/proyecto de OpenAI.
2. Revisa el saldo y la facturación de la API de ese proyecto; habilita consumo disponible.
3. Edita únicamente `Backend/.env` y guarda:
   ```dotenv
   OPENAI_API_KEY=
   OPENAI_MODEL=
   ```
   Completa ambos valores localmente. El modelo puede cambiarse por otro disponible en tu cuenta y compatible con Responses API.
4. Reinicia el backend. Si arrancaste desde la raíz con `npm run dev`, detén esa instancia con Ctrl+C y vuelve a ejecutar `npm run dev`. Si ejecutas ambos servidores por separado, reinicia solo `bun run --cwd Backend dev`. No abras otra instancia sobre el puerto 3000 ocupado.
5. Comprueba la recuperación, sin generar respuestas:
   ```powershell
   Push-Location Backend
   bun scripts/check-chat.ts
   Pop-Location
   ```
6. Con saldo disponible, comprueba cuatro preguntas reales (consume cuota):
   ```powershell
   Push-Location Backend
   bun scripts/check-chat.ts --live
   Pop-Location
   ```
7. Abre http://localhost:5173, inicia sesión, pulsa Asistente y pregunta “¿Qué es una comunidad energética?”. Después prueba Guajira, normativa, demanda y Antioquia → Medellín. Debes recibir texto y fuentes; si hay un error, la interfaz conserva un mensaje comprensible.

El script no imprime la clave. OpenAI 401, 429/cuota, timeout, red y respuesta vacía tienen mensajes controlados. La comprobación de build también exige que el archivo de ejemplo no contenga claves.

Algolia sigue sin credenciales: el chat utiliza el respaldo real descrito; el buscador global continúa indicando configuración pendiente. Para habilitar Algolia e indexar, consulta [la guía existente](MAPA_BUSQUEDA_Y_ASISTENTE.md).

## Archivos de esta corrección

Creados:

- `shared/officialSources.ts`.
- `Backend/src/services/minenergia/public-links.service.ts`.
- `Frontend/src/services/sourceService.ts`.
- `Backend/src/services/chat/localRetrieval.ts`.
- `Backend/scripts/check-chat.ts`.
- `Backend/tests/links-chat.test.ts`.
- `docs/ENLACES_Y_ACTIVACION_CHAT.md`.

Modificados:

- `Backend/src/services/minenergia/minenergia.service.ts`, `map.service.ts`, `articles.ts`.
- `Backend/src/routes/energy.routes.ts`.
- `Backend/src/services/discovery/algolia.service.ts`.
- `Backend/src/services/chat/retrievalService.ts`, `openaiService.ts`.
- `Frontend/src/components/UI.tsx`, `ChatWidget.tsx`.
- `Frontend/src/pages/CommunitiesPage.tsx`, `RegulationsPage.tsx`.
- `Frontend/src/services/discoveryService.ts`.
- `Backend/tests/external.test.ts`, `tests/e2e/platform.spec.ts`.
- `scripts/check-client-secrets.mjs`.
- `Backend/.env` (privado), `Backend/.env.example`.
- `README.md`, `docs/FUENTES_OFICIALES.md`, `docs/MAPA_BUSQUEDA_Y_ASISTENTE.md`.

No se modificaron colecciones, roles, datos históricos ni reglas de Firestore en esta corrección. No se instaló ningún paquete.

## Verificación

- Tipos de backend y frontend: correctos.
- Backend: **50 pruebas aprobadas**, incluidas URL individual/respaldo, 404, error con HTTP 200, bloqueo, JSON, redirección no oficial, falta de clave/modelo, 401, 429, red, respuesta vacía, selección geográfica y seguimiento.
- Build de producción: correcto.
- Revisión de secretos: diez archivos del build, ninguna filtración; claves vacías en el ejemplo. La búsqueda por el valor configurado en 236 archivos locales lo encontró únicamente en `Backend/.env`. Esto no elimina la exposición anterior: sigue siendo necesario revocar la clave.
- Recuperación real: las cuatro preguntas requeridas obtuvieron fuentes; Antioquia → Medellín seleccionó comunidades de Medellín. No se fabricaron nombres ni cifras.
- OpenAI real: configuración/modelo accesibles; generación rechazada por cuota. No se completaron las cuatro respuestas generadas.
- Playwright con Firebase real: **22 pruebas aprobadas y 2 fallidas** en escritorio y móvil. Los flujos de registro, encuesta, login, persistencia, logout, perfil, roles, administración, privacidad, mapa y eventos continúan pasando.
- El endpoint real del chat respondió correctamente a una consulta sin contexto y guardó CHAT_OPEN, CHAT_QUERY y CHAT_RESPONSE; esta ruta no llamó al proveedor.
- Contrato de respuesta con fuentes y conversación: comprobado con respuestas simuladas exclusivamente en tests. No equivale a generación real.
- Se abrieron detalles y enlaces de **cinco comunidades diferentes en ambas resoluciones**, y se comprobaron sus cinco eventos CLICK_EXTERNAL_SOURCE. Falló la comprobación final de contenido externo porque el Ministerio bloqueó el navegador en las diez aperturas. Las pruebas no ocultan ese fallo.
- No se cambiaron reglas de Firestore ni se volvieron a publicar. La suite comprobó contra Firestore real la separación de perfiles, roles y permisos.

Comunidades comprobadas:

1. ASOCIACION DE AUTORIDADES TRADICIONALES INDIGENA WAYUU OLOIJIRAWA AGUAIPA.
2. ORGANICACION DEL PUEBLO YUWA.
3. ASOKUISA ASOCIACION DE AUTORIDADES ANCESTRALES ZONA DE KUISA.
4. ASOCIACION DE CAMSPESINOS NUEVA ESPERANZA ASOCANOE.
5. JAC LA PLAZUELA.

Se conserva la grafía de la fuente oficial. El informe de navegador está en `playwright-report/index.html`; incluye la evidencia de los bloqueos. Las cuentas temporales se eliminaron al terminar.

Para repetir las pruebas del navegador con los servidores iniciados:

```powershell
Remove-Item Env:\DEBUG -ErrorAction SilentlyContinue
$env:VC_E2E_REAL='true'
$env:VC_E2E_CHAT_CONFIGURED='true'
npm run test:e2e:running
```

La segunda variable habilita la prueba del chat sin fuentes y requiere configuración local; no efectúa generación ni consume cuota. Las pruebas de enlaces externos seguirán fallando si el Ministerio mantiene el bloqueo.
