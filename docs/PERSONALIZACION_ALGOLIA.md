# Personalización desde backend — 22 de septiembre de 2026

La búsqueda y las recomendaciones reutilizan Express, Firebase Authentication, Firestore y algoliasearch 5.59.0. No se instalaron dependencias ni se cambiaron las pantallas, rutas o reglas. No se usa Algolia Personalization, Dynamic Re-Ranking ni aprendizaje automático.

## Qué se comprobó en la conexión real

El índice configurado en Backend/.env es visual_community_content y respondió con 17.508 registros. Al consultar sus ajustes mediante la API, los atributos buscables eran title, keywords, municipality, department y description; las facetas eran topics, category, department, municipality y los filtros kind/source. El ranking personalizado era desc(interactions), desc(views), desc(publishedTimestamp). Los sinónimos sí estaban presentes.

Estos ajustes no coincidían con la lista en español comunicada. El script anterior ejecutaba setSettings antes de cada indexación y podía reemplazar los ajustes manuales. Se retiró esa escritura. Durante esta tarea NO se reindexó ni se modificó la configuración remota.

## Datos que utiliza

- Preferencias reales en profiles/{uid}.preferences.topics, conservando compatibilidad con interests antiguos.
- Hasta 200 eventos recientes de profiles/{uid}/interactions.
- Se cuentan consultas de artículos, normativa, indicadores y comunidades, clics de fuentes, búsquedas con categoría, resultados y recomendaciones abiertas.
- LOGIN, LOGOUT y operaciones de cuenta no se convierten en intereses temáticos.
- Se recuperan hasta 50 contenidos distintos del historial mediante una sola llamada getObjects. El contenido debe coincidir con el identificador y la fuente del evento.
- Temas, departamento y municipio provienen del contenido consultado. Los lugares son intereses de consulta, NO residencia ni ubicación actual del usuario.
- Sin datos geográficos verificables no se asigna preferencia geográfica. Los municipios se comparan junto con su departamento para evitar homónimos.

El resultado se guarda en la subcolección existente profiles/{uid}/interestProfile/current. Conserva declaredPreferences, topicInteractionCounts, recentTopics, affinity, sampleSize y updatedAt; agrega geography.departments y geography.municipalities. No cambia preferencias declaradas ni borra eventos.

El uid procede del token Firebase verificado, nunca de un uid enviado en parámetros del buscador. Las reglas existentes mantienen este perfil derivado con escritura exclusiva desde backend y lectura administrativa. Las claves, el perfil completo y el historial individual nunca se envían al navegador mediante las recomendaciones.

## Cómo se puntúan las recomendaciones

Por cada tema:

- Preferencia declarada: 6 puntos.
- Consultas observadas: min(10, 2 × log2(1 + cantidad)).
- Si se consultó durante los últimos 7 días: 2 puntos adicionales.
- Fechas futuras no cuentan como actividad.

Para cada contenido se toma su mayor afinidad temática. Se agrega hasta 2 puntos por departamento y hasta 2 por municipio+departamento consultado, usando min(2, log2(1 + cantidad)/2) para cada lugar. La fecha de publicación aporta hasta 1 punto, que disminuye linealmente durante 90 días. La popularidad aporta hasta 1 punto: min(1, log2(1 + interacciones + vistas)/10).

No se usa indexedAt como fecha de publicación. Ausencia de fecha o contadores no se presenta como un dato conocido. Contadores negativos o no finitos no suman puntos.

GET /api/discovery/recommendations consulta hasta 30 candidatos mediante Algolia y devuelve 6, con motivos como “Por tu interés en Demanda de energía”, “Por tus consultas sobre Normativa…” o “Has consultado comunidades de MEDELLÍN (ANTIOQUIA)”. Un usuario sin señales recibe contenidos oficiales por actualidad/popularidad disponibles o exploración.

## Filtros y relevancia textual

La configuración real de facetas se detecta con una consulta sin hits, almacenada en caché por 60 segundos. Se admiten topics/category y temas/categoria, con identificadores estables como regulation y renewable_energy, o los nombres completos de las opciones del onboarding.

Para consultas vacías, incluidas recomendaciones:

- optionalFilters asigna puntajes a temas y categorías según la afinidad, con un máximo de 180 por tema.
- Categoría y temas del mismo interés se agrupan con OR; sumOrFiltersScores=false evita contar esa coincidencia dos veces dentro del grupo.
- Hasta tres departamentos consultados pueden recibir boosts de hasta 20 puntos.
- El municipio se aplica en el scoring del backend junto con su departamento.
- No hay filtros excluyentes por preferencias: otros temas siguen accesibles.

Para búsquedas con texto:

- Se envía la consulta original a Algolia sin boosts opcionales, con getRankingInfo=true.
- Se conserva el orden textual de Algolia. Solo grupos consecutivos con idénticos datos de relevancia se desempatan por intereses.
- Se comparan errores tipográficos, palabras coincidentes, proximidad, atributo/posición, palabras exactas y datos de promoción/distancia si existen.
- No se reordena si falta información de ranking; no se cruzan límites de página.
- Esto evita que un boost de preferencia, que el ranking predeterminado evalúa antes de ciertos criterios textuales, adelante una coincidencia peor.
- Un filtro category elegido expresamente por el usuario sí restringe resultados a su categoría o temas. Las preferencias nunca lo reemplazan.

Cada consulta desactiva enablePersonalization, enableReRanking, analytics y clickAnalytics; usa queryLanguages=["es"]. No se envía userToken ni uid a Algolia. La app sigue registrando sus eventos propios en Firestore.

Referencia: [optionalFilters](https://www.algolia.com/doc/api-reference/api-parameters/optionalFilters), [orden de ranking](https://www.algolia.com/doc/api-reference/api-parameters/ranking) y [datos de relevancia](https://www.algolia.com/doc/api-reference/api-parameters/getRankingInfo).

## Campos del índice y configuración manual

El contrato interno y los payloads article, community y metric se conservan para que el detalle y las fuentes sigan funcionando. El adaptador lee los campos equivalentes en español y las próximas indexaciones publican ambos nombres:

| Interno | Alias para el dashboard |
|---|---|
| title | titulo |
| municipality | municipio |
| department | departamento |
| keywords | palabrasClave |
| topics | temas |
| category | categoria |
| description | descripcion |
| source | fuente |
| interactions | interacciones |
| views | vistas |
| publishedTimestamp | timestampPublicacion |

timestampPublicacion es la fecha publicada en segundos Unix y solo se agrega cuando el contenido ya dispone de publishedTimestamp. No es una fecha inventada ni la fecha de indexación. Si cambias el custom ranking al esquema español, el nombre exacto es desc(timestampPublicacion), junto con desc(interacciones) y desc(vistas).

No es necesario cambiar los ajustes actuales para utilizar esta implementación. Si quieres pasar los ajustes remotos a los nombres españoles, primero actualiza los registros con el script para que esos atributos existan; después selecciona sus nombres en el dashboard. Mantén los payloads internos al importar registros: un documento incompleto se rechaza, no se inventa una ficha.

La indexación conserva settings, synonyms y rules mediante los scopes del [reemplazo de registros del SDK](https://www.algolia.com/doc/libraries/sdk/methods/search/replace-all-objects). El catálogo sí se reemplaza, como antes: úsalo solo en el índice exclusivo de esta plataforma.

## Variables y ejecución

Solo en Backend/.env:

```dotenv
ALGOLIA_APP_ID=
ALGOLIA_SEARCH_API_KEY=
ALGOLIA_ADMIN_API_KEY=
ALGOLIA_INDEX_NAME=visual_community_content
```

La clave de búsqueda necesita permiso search sobre el índice. La clave administrativa se usa para indexar, no para las solicitudes normales. No se requieren variables nuevas ni claves en Vite. Las credenciales existentes se conservaron.

Desde la raíz:

```powershell
npm run dev
npm run typecheck
npm test
npm run build
node scripts/check-client-secrets.mjs
```

Si el servidor ya estaba ejecutándose sin reinicio automático, reinicia el backend para cargar los cambios. Las preferencias e interacciones pueden tardar hasta 60 segundos en reflejarse debido a la caché.

Para actualizar posteriormente el catálogo y sus alias, desde Backend:

```powershell
bun scripts/index-content.ts --dry-run
bun scripts/index-content.ts
```

El primer comando prepara una vista previa; el segundo escribe registros públicos en Algolia. No ejecutarlos en cada búsqueda. Las fuentes deben estar completas y el plan debe admitir el catálogo y el índice temporal.

## Pruebas y límites

Se verificaron búsquedas contra Algolia real: preferencias de normativa, demanda y comunidades dieron distintos primeros resultados, conservando el total de 17.508 contenidos. Una búsqueda de La Guajira con filtro explícito de comunidades funcionó. Una coincidencia textual puede mencionar La Guajira aunque pertenezca a otro departamento: buscar texto no equivale a filtrar geografía.

Se verificó el flujo con un perfil real de Firestore: 3 preferencias, 30 eventos recientes, 5 temas observados, 1 departamento consultado y 6 recomendaciones de Algolia con explicación. Solo se actualizó su perfil de intereses derivado; no se registraron eventos ficticios ni se imprimieron datos personales.

Las pruebas automatizadas cubren distintas preferencias, historial, ausencia de señales, fechas futuras, geografía verificable y homónimos, esquemas español/inglés, filtros, errores y conservación de ajustes. Se mantienen las pruebas existentes de autenticación, fuentes y chat.

La personalización usa muestras acotadas, no todo el historial. La popularidad del índice conserva el cálculo existente: hasta 100 participantes normales y hasta 100 eventos por participante al indexar; no incluye administradores y no es un total histórico global. Los contadores y datos de publicación se actualizan al reindexar, no con cada clic.

Si Algolia falla, las recomendaciones utilizan el catálogo real local con un aviso; el buscador muestra su error controlado. La consulta de lugares del historial es opcional: si falla, siguen funcionando los intereses declarados y las categorías de eventos. No se modificó Gemini en esta tarea.

## Archivos

Creados: Backend/src/services/discovery/indexSchema.ts, historyContent.service.ts, scoring.ts; Backend/tests/personalization.test.ts; esta guía.

Modificados: Backend/src/services/discovery/algolia.service.ts, interest.service.ts, recommendation.service.ts, indexing.service.ts; shared/discovery.ts; Backend/tests/discovery.test.ts; README.md; Backend/README.md; docs/MAPA_BUSQUEDA_Y_ASISTENTE.md.

Sin nuevas rutas, dependencias, migraciones ni cambios de reglas.
