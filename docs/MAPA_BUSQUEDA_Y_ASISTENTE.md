# Mapa, búsqueda, recomendaciones y asistente — 21 de septiembre de 2026

**Actualización posterior:** consulta [enlaces y activación del chat](ENLACES_Y_ACTIVACION_CHAT.md) para los enlaces corregidos, recuperación sin Algolia y el error real de cuota de OpenAI. Los resultados de pruebas al final de este documento corresponden a la etapa anterior.

**Proveedor actual del asistente:** Google Gemini; consulta [GEMINI.md](GEMINI.md). Las referencias a OpenAI y sus pruebas en este documento corresponden a la implementación anterior, conservada como referencia.

**Algolia ya está conectado:** el estado, la indexación y la personalización de esta etapa histórica fueron actualizados. Consulta [la guía vigente de personalización](PERSONALIZACION_ALGOLIA.md). El script ya no configura ni sobrescribe los ajustes del índice.

## Estado y arquitectura conservada

React 19 + Vite + TypeScript en Frontend. Express 5 + Bun en Backend. Firebase Authentication identifica por uid; Firestore guarda perfiles, preferencias, eventos y métricas. No hubo migración, cambio de roles ni borrado de historial. Los administradores continúan excluidos del análisis de participantes.

El mapa y las recomendaciones del catálogo local funcionan con datos reales. Algolia y OpenAI están implementados pero pendientes de credenciales, por decisión del usuario. No se creó un índice remoto ni se efectuaron llamadas reales a OpenAI. Los estados sin configuración son explícitos y no bloquean otras secciones.

## Mapa

- Fuente: Ministerio de Minas y Energía.
- Capa: `https://arcgisenterprise.minenergia.gov.co/server/rest/services/Comunidades_Energ%C3%A9ticas/MapServer/0`.
- Primero GET `/query?f=json&where=1%3D1&returnIdsOnly=true`; después POST `/query`, `objectIds`, `outSR=4326`, `returnGeometry=true`.
- Lotes de 2.000 ids, hasta tres simultáneos; caché de 15 minutos. Se verifica que no falten ids.
- Campos solicitados: FID, Nombre_de_, Departamen, Municipio, Estado, Rural___Ur, Operador_d, Ejecutor y geometría. No se descargan campos de contacto.
- Verificado: 17.499 registros con coordenadas. Incluye postulaciones; no acredita proyectos ejecutados.
- React Leaflet 5.0.0 + Leaflet 1.9.4; tipos 1.9.22. Los marcadores usan canvas y el componente se carga de forma diferida.
- Fondo OpenStreetMap, con atribución visible. No requiere clave; observar su [política de teselas](https://operations.osmfoundation.org/policies/tiles/) al desplegar a gran escala.
- El popup abre CommunityDialog. Su enlace público se valida con los respaldos de `shared/officialSources.ts`; la ruta antigua `/es/comunidades-energeticas/` fue retirada por devolver 404.
- Si falla la capa, se ofrece reintentar; si falla el fondo, se avisa y se conservan marcadores.

## Configurar Algolia

En `Backend/.env`, completar sin compartir las claves:

```dotenv
ALGOLIA_APP_ID=
ALGOLIA_SEARCH_API_KEY=
ALGOLIA_ADMIN_API_KEY=
ALGOLIA_INDEX_NAME=visual_community_content
OPENAI_API_KEY=
OPENAI_MODEL=
```

Todas estas variables son del backend. No usar prefijo VITE_. La clave de búsqueda debe tener permiso search limitado al índice; la clave administrativa solo se usa en el script de indexación, nunca en el navegador. No se envía uid, nombre o correo a Algolia. Se envían consulta, filtros y afinidades temáticas; analytics y clickAnalytics están desactivados en las peticiones.

Crear una aplicación y un índice **exclusivo de Visual Community**. El nombre propuesto es `visual_community_content`; todavía no existe un índice remoto creado por esta etapa. SDK: algoliasearch 5.59.0.

Desde la raíz:

```powershell
Push-Location Backend
bun scripts/index-content.ts --dry-run
bun scripts/index-content.ts
Pop-Location
```

El primer comando solo consulta fuentes y escribe `artifacts/content-index-preview.json`. El segundo requiere credenciales; configura el índice y lo reemplaza mediante un índice temporal del SDK. No apuntarlo a un índice compartido: su catálogo se reemplaza. No modifica Firestore ni los eventos durante la indexación.

La vista previa reunió 17.508 documentos: 17.499 comunidades, tres recursos editoriales del Ministerio, tres resoluciones CREG y tres indicadores XM. Verificar capacidad del plan Algolia para este volumen y el índice temporal. El proceso se detiene antes de publicar si alguna fuente está incompleta. La indexación no se ejecuta automáticamente al iniciar la app; repetirla para incorporar cambios. Para indicadores XM, el chatbot vuelve a consultar el servicio vigente antes de responder.

No se inventan publicaciones, valoraciones ni cifras. `indexedAt` significa momento de preparación del catálogo, no fecha de publicación. `publishedAt` permanece null si no se conoce.

### Atributos y orden

- Buscables: title, keywords, municipality, department, description.
- Facetas/filtros: kind, source, topics, category, department, municipality.
- customRanking: desc(interactions), desc(views), desc(publishedTimestamp).
- optionalFilters: topics con score de afinidad. Las preferencias ordenan; no ocultan otras categorías.
- Filtro excluyente de tema únicamente cuando el usuario lo selecciona expresamente.

La popularidad usa una **muestra** de hasta 100 perfiles con rol user y 100 eventos recientes por perfil, solo durante indexación. Excluye administradores. `views` cuenta consultas de contenidos; `interactions` incluye además clics en fuentes, recomendaciones, marcadores y resultados. Son contadores de esa muestra, no totales históricos. Se registra su cobertura en la vista previa; no se envían identidades ni eventos individuales a Algolia. El primer despliegue debe revisar si la muestra resulta suficiente.

Documentación: [optionalFilters](https://www.algolia.com/doc/api-reference/api-parameters/optionalFilters), [customRanking](https://www.algolia.com/doc/api-reference/api-parameters/customRanking), [reemplazo seguro](https://www.algolia.com/doc/libraries/sdk/methods/search/replace-all-objects).

## Perfil de intereses y recomendaciones

Se conserva `profiles/{uid}.preferences.topics`. El backend lee hasta 200 eventos recientes propios y calcula `profiles/{uid}/interestProfile/current`:

- declaredPreferences;
- topicInteractionCounts;
- recentTopics;
- affinity;
- sampleSize y updatedAt.

Por tema: 6 puntos si fue declarado + min(10, 2 × log2(1 + consultas)) + 2 si hubo una consulta en los últimos siete días. Se reconocen identificadores de eventos antiguos y las nuevas categorías. Un historial frecuente de normativa puede superar una preferencia inicial por renovables.

El contenido recibe la afinidad de su tema más cercano, hasta un punto por actualidad verificable de los últimos 90 días y hasta un punto por popularidad, cuando existe. Cada tarjeta explica si proviene de una preferencia o de consultas anteriores. No hay ML ni clasificación de riesgo.

Caché de intereses: 60 segundos. Se utiliza la muestra reciente, no todos los eventos históricos. El usuario recibe recomendaciones, no el perfil de seguimiento ni sus contadores. Solo el backend escribe el perfil derivado; su lectura directa requiere admin.

Con Algolia se recuperan hasta 30 candidatos y se recomiendan seis. Sin Algolia, se usa el catálogo real disponible: recursos editoriales, normativa, métricas y la primera página de comunidades, con aviso explícito y diversidad por tipo. Este respaldo no sustituye el buscador global: este informa de la configuración pendiente.

## Buscador y chatbot

Nuevas rutas:

| Ruta | Uso |
|---|---|
| /buscar | Búsqueda global protegida |
| GET /api/energy/map | Capa geográfica pública normalizada, con sesión |
| GET /api/discovery/search | Búsqueda personalizada; q, page y category |
| GET /api/discovery/recommendations | Tarjetas propias del usuario autenticado |
| POST /api/chat | Pregunta e historial acotado, con sesión |

Flujo del chatbot: chatService → retrievalService → Algolia o catálogo oficial existente → openaiService → Responses API. retrievalService usa afinidades y el tema anterior para preguntas de seguimiento; devuelve como máximo cinco contenidos. No se descarga una página ni se interpreta un endpoint JSON como fuente visible.

OpenAI SDK oficial **7.20.0**, método `client.responses.create`. `OPENAI_MODEL` es obligatorio, configurable y no tiene modelo predeterminado. Elegir un modelo que la cuenta pueda usar con Responses API; esta etapa no presupone uno concreto.

Hasta 1.200 caracteres por pregunta, cuatro mensajes previos de hasta 1.200 caracteres y 1.000 tokens máximos de salida. Timeout de OpenAI 20 segundos; sin reintentos automáticos. Máximo seis consultas por minuto y una en curso por uid, en memoria del proceso. Para varios servidores será necesario compartir el limitador.

El botón se bloquea durante la solicitud y no hay llamadas a OpenAI al cargar páginas. Ante falta de contexto, no se llama a OpenAI y se responde que no hay información suficiente. Maneja claves/modelo ausentes, 429/cuota, errores de red, respuesta vacía y fallos temporales. No muestra stack traces.

Las respuestas son texto sin ejecutar HTML y con referencias [1], [2]. Los enlaces mostrados salen únicamente de las fuentes recuperadas, con dominios oficiales permitidos y sin endpoints técnicos. Los resúmenes no reemplazan una norma completa ni aseguran su vigencia.

Conversación solo en memoria del frontend, últimos diez mensajes visibles; se borra con Nueva conversación, recarga o salida de la sesión. `store:false` desactiva el almacenamiento de la respuesta por Responses API, pero no sustituye las políticas de retención operativa del proveedor. [Contexto de conversación oficial](https://developers.openai.com/api/docs/guides/conversation-state).

## Eventos y privacidad

Se conserva `profiles/{uid}/interactions/{id}`, timestamp del servidor y uid de Authentication.

Nuevos eventos: VIEW_ENERGY_MAP, CLICK_ENERGY_COMMUNITY_MARKER, SEARCH, SEARCH_RESULT_CLICK, RECOMMENDATION_CLICK, CHAT_OPEN, CHAT_QUERY, CHAT_RESPONSE, CHAT_SOURCE_CLICK. Se mantienen VIEW_ENERGY_COMMUNITY y todos los anteriores.

Nuevos metadatos admitidos: category (tema conocido) y queryLength (0–1200). **No guardamos query ni el texto de las conversaciones en Firestore**: se registra categoría y longitud para reducir información sensible. Las consultas se transmiten al proveedor correspondiente solo al usar esa función.

Las reglas validan eventos/categorías/longitudes, impiden editar o borrar eventos, y mantienen perfiles propios y analítica administrativa. Ya se publicaron tras pasar pruebas de emulador. No es necesario abrir permisos ni cambiar roles. Administración muestra los nuevos tipos en su historial y frecuencias de la muestra, conservando la exclusión de administradores.

## Ejecutar y comprobar

Desde la raíz:

```powershell
bun install
bun install --cwd Backend
bun install --cwd Frontend
npm run dev
```

Frontend http://127.0.0.1:5173; backend http://127.0.0.1:3000/api/health. La ejecución normal sigue usando Firebase real.

```powershell
npm run typecheck
npm test
npm run build
npm run test:rules
$env:VC_E2E_REAL="true"
npm run test:e2e:running
```

Las pruebas de reglas usan un proyecto demo aislado. Las E2E reales crean y eliminan cuentas temporales; no modifican roles de desarrolladores. Hay dobles de prueba explícitos para validar contratos de Algolia/OpenAI sin credenciales: no son resultados reales de esos proveedores ni se incluyen como contenido de la aplicación.

## Pendiente de activación

- Crear/configurar la aplicación, índice y claves de Algolia; ejecutar indexación real y verificar cuota y ranking con su cuenta.
- Completar OPENAI_API_KEY y OPENAI_MODEL, reiniciar backend y probar generación real/costo.
- Automatizar indexación si se necesita actualización periódica. Ahora es una tarea manual.
- Ampliar muestras/contadores y distribuir el rate limit al crecer.
- CREG sigue siendo catálogo editorial; esta etapa no inventa ni añade una API.
- El mapa usa la capa oficial, que puede contener ubicaciones imprecisas; no las corrige ni inventa.

## Resultado de verificación final

- `npm run dev`: frontend en 5173 y health del backend en 3000 con `authMode: firebase`.
- `npm run typecheck`: correcto en backend y frontend.
- `npm test`: **41 pruebas aprobadas**, incluidas indexación, boosts/filtros, perfil de intereses, datos geográficos, Responses API mediante doble de prueba, falta de contexto/clave/modelo, cuota y errores.
- `npm run test:rules`: **11 pruebas aprobadas** en emulador; reglas publicadas después en Firestore real.
- Suite Playwright con Firebase real: **20 pruebas aprobadas**, diez en escritorio y diez en móvil. Incluye los flujos anteriores y mapa, recomendaciones, eventos, estados sin claves y contratos de búsqueda/chat simulados solo en tests.
- Vista previa final de indexación: **17.508 registros**, ninguna escritura en Algolia. La cobertura de popularidad se encuentra en `artifacts/content-index-preview.json`.
- `npm run build`: correcto. Mapa en chunk independiente.
- `node scripts/check-client-secrets.mjs`: **10 archivos examinados, ninguna filtración detectada**. Compara secretos configurados y marcadores de claves privadas sin imprimir valores.

No se verificó indexación remota ni generación real porque todavía no hay cuentas/claves de Algolia y OpenAI. Las pruebas con dobles de proveedor no reemplazan esa validación pendiente.
