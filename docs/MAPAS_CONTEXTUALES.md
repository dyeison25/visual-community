# Mapas contextuales dinámicos

Implementación del 28 de octubre de 2026. Publicación autorizada por el propietario después de repetir satisfactoriamente el build final completo. Destinos existentes: Firebase Hosting (`sistemagestionpermanencia`) para el frontend y Render (`visual-community-api`) para el backend. No se cambia el cron de recordatorios, Firebase, Firestore, Algolia ni el mapa principal del dashboard.

## Qué hace `/buscar`

La consulta genera dos respuestas independientes: los documentos habituales de Algolia y una representación geográfica oficial relacionada con el tema y el lugar. El conteo del mapa no es el total de Algolia. Un error de UPME/DANE no bloquea las tarjetas, filtros, paginación ni personalización existentes. Se validan también los contratos recibidos por el navegador y MapBoundary aísla cualquier fallo inesperado de dibujo.

| Consulta | Selección |
|---|---|
| Comunidades energéticas en Antioquia | Postulaciones, filtradas territorialmente |
| Radiación solar | Capa temática WMS nacional; permite pasar a polígonos |
| Radiación solar en La Guajira | Polígonos con atributos territoriales |
| Potencial eólico | Recurso eólico a 20 metros; WMS o polígonos |
| Proyectos solares en Antioquia | Generación, tecnología solar y departamento |
| Subestaciones en Medellín | Infraestructura puntual y municipio |
| Líneas de transmisión | Infraestructura lineal |
| Capacidad asignada | Asignaciones/puntos de conexión, no ubicación exacta de plantas |
| Energías renovables | Selector de mapas pertinentes, sin elección arbitraria |
| Comunidades en Santa Rosa | Selección de municipio ante homónimos |
| Normativa solar / noticias / demanda / qué es una comunidad | Sin mapa automático |

Se emplean reglas explicables; no Gemini ni Machine Learning. La consulta y los controles explícitos tienen prioridad. El perfil de intereses sigue ordenando Algolia, pero no inventa una ubicación ni fuerza un mapa. Los controles del mapa usan `mapLayer`, `mapDepartment`, `mapMunicipality`, `mapTechnology` y `mapDisplay`, conservando `q`, `category` y `page`. Una nueva búsqueda desde el formulario reinicia esos controles.

## Fuentes cerradas

Raíz UPME: `https://geo.upme.gov.co/server/rest/services/`. Las rutas siguientes son internas; los enlaces al usuario apuntan a geovisores públicos, no a JSON.

| Identificador | Ruta verificada | Geometría |
|---|---|---|
| communities | Capas_EnergiaElectrica/comunidades_energeticas_postuladas/FeatureServer/19 | Punto |
| solar | Capas_FuenteEnergia_Solar/radiacion_horizontal_media_dia_anual_2024/MapServer/3 | Polígono |
| wind | Capas_FuenteEnergia_Eolica/energia_eolica_20metros/MapServer/10 | Polígono |
| generation | Capas_EnergiaElectrica/proyectos_generacion_xm/FeatureServer/24 | Punto |
| substations | Capas_EnergiaElectrica/sistema_transmision_subestaciones_construidas/FeatureServer/18 | Punto |
| transmission | Capas_EnergiaElectrica/convocatorias_lineas_transmision/FeatureServer/1 | Línea |
| connection | Capas_EnergiaElectrica/capacidad_asignada/FeatureServer/31 | Punto |

WMS solar/eólico utiliza `/server/services/{servicio}/MapServer/WMSServer`, versión 1.1.1 y el nombre de capa publicado **0**, distinto de los IDs REST 3/10. El backend solicita solo PNG, 640 × 480, en EPSG:3857, la proyección de Leaflet. Recorta la petición a la intersección del área visible con la extensión oficial de cobertura consultada en UPME. La cabecera `X-Map-Bounds` conserva el encuadre WGS84 donde colocar la imagen y se expone mediante CORS. React solicita el PNG con el ID token, crea un Blob temporal y lo representa con ImageOverlay. No se ponen tokens en URLs de imágenes. Un clic WMS consulta registros reales en una ventana pequeña; si hay varios, se invita a elegir desde geometrías.

Referencia administrativa: `https://geoportal.dane.gov.co/mparcgis/rest/services/MGN2025/Serv_CapasMGN_2025/MapServer`, municipios 317 y departamentos 319. Solo se lee una referencia ligera de nombres/códigos (1.122 filas en la comprobación) y extensiones seleccionadas; no se descargan todos los polígonos del país. La consulta exige código municipal no nulo, sin campos personales. No se envía al navegador el catálogo completo de municipios.

**Respaldo territorial en Render:** la comprobación real encontró reinicios de conexión DANE (`ECONNRESET`), mientras UPME sí respondió. Si falla DANE, se consulta el catálogo oficial UPME `SITIOSUPME/UPME_BC_Sitios_UPME_Division_Politica/MapServer`: capa 0 (solo nombres/códigos, 1.123 filas observadas), 1 (encuadre departamental) y 3 (encuadre municipal). El servicio declara **vigencia 2013**, por lo que la interfaz advierte siempre su antigüedad y posibles municipios/límites recientes ausentes. No se presenta como división actual. Se concatenan únicamente los componentes DIVIPOLA oficiales de dos y tres dígitos; los códigos con nombres contradictorios se omiten. No se inventan encuadres si el servicio no los devuelve. El respaldo permanece en memoria 15 minutos y después se reintenta la fuente primaria. La antigüedad territorial no cambia los datos ni las fechas de las capas energéticas.

**Precisión territorial:** se filtra por códigos oficiales o nombres de la propia capa cuando están disponibles. Las capas sin atributos administrativos, como potencial eólico y líneas, se consultan por intersección con la extensión rectangular oficial DANE. Esa extensión no es un límite administrativo ni un recorte exacto: la interfaz lo advierte. El área visible se intersecta además con la seleccionada; desplazar el mapa no elimina silenciosamente el filtro territorial.

Las coordenadas vectoriales se solicitan en WGS84 (`outSR=4326`), se validan y nunca se completan con ubicaciones supuestas. Líneas y polígonos se simplifican por el servicio (`maxAllowableOffset=0.001` en grados) para visualización. Una postulación no implica operación. MW no equivale a MWh. Se muestran unidades, simbología oficial disponible y fechas por registro; los atlas son históricos. La tecnología se obtiene de valores distintos reales de cada capa; la consulta paginada debe ordenar por ese mismo campo para evitar el error ArcGIS 400. El control "Todas las tecnologías" anula explícitamente la inferencia.

## Backend y límites

Las rutas requieren el middleware Firebase ya existente:

- `GET /api/geography/context`: intención, mapas posibles, lugares, filtros y leyenda.
- `GET /api/geography/features`: GeoJSON saneado del área visible, máximo **250** registros. El aviso de muestra parcial invita a acercar el mapa; no pagina el país completo automáticamente.
- `GET /api/geography/wms`: PNG autenticado, sin URLs, estilos, operaciones ni SQL arbitrarios del cliente.
- `GET /api/geography/availability`: diagnóstico autenticado, sin parámetros, de dos metadatos cerrados UPME/DANE. No consulta perfiles ni ejecuta trabajos. Solo expone disponibilidad y códigos controlados, nunca credenciales, errores originales ni cuerpos de terceros.

Presupuesto independiente: 45 solicitudes por usuario/minuto, sin consumir el contador compartido de búsqueda/chat. Como máximo tres peticiones oficiales simultáneas y doce en espera; plazo de 12 segundos para JSON y 20 para PNG (el WMS nacional puede tardar más). La desconexión del cliente cancela la lectura y libera el cupo. Límite de respuesta: 4 MB JSON / 1,2 MB PNG. La caché pública de proceso admite 64 entradas y 12 MB: datos 5 minutos, imágenes 1 minuto, metadatos/tecnologías/cobertura 30 minutos, referencia DANE 24 horas. Se descartan respuestas fallidas; no hay persistencia, exportación masiva ni escrituras Algolia/Firestore.

Solo se aceptan hosts HTTPS y rutas cerradas, sin credenciales ni redirecciones. Los parámetros extra, arrays, bbox inválidos, capas irrelevantes y códigos/tecnologías no publicados se rechazan. Las respuestas contienen títulos y hechos seleccionados; identificaciones, NIT, correos y demás campos ajenos a la lista permitida no llegan al navegador aunque el proveedor los devuelva. Los errores no contienen trazas ni respuestas privadas del proveedor. No se añaden eventos, permisos, colecciones ni reglas Firestore.

## Prueba local con Firebase existente

Desde la raíz, en PowerShell, sin modificar `.env`:

```powershell
$env:NODE_ENV='development'
$env:PORT='3000'
$env:HOST='127.0.0.1'
$env:VITE_DEV_PORT='5173'
$env:FRONTEND_ORIGIN='http://127.0.0.1:5173'
$env:VITE_API_BASE_URL='/api'
$env:API_PROXY_TARGET='http://127.0.0.1:3000'
bun run dev
```

Abrir `http://127.0.0.1:5173/buscar`, iniciar sesión con la cuenta habitual y escribir las consultas de la tabla. La configuración pública Firebase y las credenciales backend ya utilizadas siguen siendo necesarias; no se crean claves nuevas. El override `/api` es importante si el `.env` frontend apunta al Render publicado, que todavía no contiene estas rutas. El servidor web no ejecuta el job de correos.

Para revisar sin usuarios reales: `bun run dev:emulators` y los mismos overrides de proxy; se emplea exclusivamente el proyecto demo. Las pruebas E2E eligen sus puertos 3001/5174 y emuladores de forma explícita.

## Verificación y pruebas

```powershell
bun run typecheck
bun test Backend/tests
bun run test:packaging
bun run test:notifications
$env:VC_E2E_REAL='false'
$env:VC_E2E_GREP='mapas contextuales'
$env:VC_E2E_GEO_LIVE='true'
bun run test:e2e
Remove-Item Env:VC_E2E_GREP
Remove-Item Env:VC_E2E_GEO_LIVE
bun run build
bun run test:build-ui
```

Las fixtures están marcadas como sintéticas y solo existen en pruebas. Las E2E verifican siete capas, Canvas, WMS, detalles, filtros independientes de Algolia, selección ambigua, fallos y cancelación al cambiar de búsqueda. `VC_E2E_GEO_LIVE=true` habilita también comprobación visual de WMS solar y generación solar real en Antioquia; cuentas y actividad siguen en emuladores, y solo se simulan los documentos Algolia de esa prueba. Las capturas se guardan en `artifacts/`, excluido de Git.

## Comprobación de Render antes de publicar

La publicación fue autorizada. Antes de desplegar Hosting se debe comprobar la nueva API en Render con una sesión Firebase válida. El diagnóstico local no certifica por sí solo la conectividad saliente de Render.

El diagnóstico de solo lectura puede ejecutarse localmente:

```powershell
bun run --cwd Backend verify:geography
```

Después de un despliegue autorizado, en Render Shell, desde `/app/Backend`:

```sh
bun dist/verify-geography.js
```

El build incluye ese bundle en la imagen existente, sin cambiar Dockerfile. No inicia el API, Firebase, Algolia ni recordatorios. Consulta dos registros por capa, metadatos, dos PNG y el encuadre oficial de Medellín. Emite exclusivamente capa, estado, conteos, bytes y códigos controlados; sale con error si falta una comprobación. No es un endpoint público ni una tarea automática. Ante un fallo de conectividad, mantener el mapa aislado y revisar egreso/servicio; no alterar las reglas Firebase ni activar envíos para diagnosticarlo.

Si el plan no ofrece Shell, no es necesario contratar un servicio: se pueden comprobar las mismas rutas autenticadas desde la plataforma. La disponibilidad de `/api/health` por sí sola no certifica acceso saliente a UPME. La verificación remota durante esta publicación confirmó acceso a UPME y reinicios de conexión DANE; por eso se añadió el respaldo oficial explícitamente identificado como histórico.

## Validación y publicación

Resultado de la revisión local: TypeScript del código final correcto y **157 pruebas backend** correctas (incluyen unidades e integración HTTP geográfica); **46 pruebas de reglas/notificaciones** y **3 de empaquetado** correctas. La suite completa de interfaz terminó con 34 correctas, dos omitidas por configuración del chat y dos fallidas por el bloqueo externo conocido de la página MinEnergía. Las ocho pruebas nuevas de mapas pasaron en esa suite, incluidas WMS solar y generación real en escritorio/móvil. Tras reforzar respuestas inesperadas se repitieron los seis casos de interfaz con fixtures: todos correctos.

La repetición final del build de producción pasó con el código actualizado: API, frontend, recordatorios y diagnóstico geográfico compilados. La revisión del bundle no detectó secretos. También pasaron nuevamente las 157 pruebas backend y la comprobación de renderizado del build en escritorio/móvil. El diagnóstico compilado verificó las siete capas, dos PNG WMS y el encuadre oficial de Medellín.

Antes de publicar se repitieron las seis pruebas de interfaz con fixtures y las dos consultas visuales oficiales. La primera consulta WMS de escritorio encontró un timeout externo de 20 segundos; la aplicación mostró el error sin bloquear Algolia. La repetición de las dos pruebas oficiales pasó en escritorio y móvil sin cambios de código ni sustitución de datos oficiales.

Después del diagnóstico de Render se añadieron pruebas de códigos de error seguros, redirecciones no seguidas, disponibilidad autenticada y respaldo territorial. Pasaron **164 pruebas backend**, TypeScript del proyecto completo y la verificación real de las siete capas usando el respaldo (dos registros por capa, sin geometrías territoriales masivas). Los diagnósticos no incluyen mensajes originales, destinos de redirección, tokens ni credenciales.

No se añaden dependencias, API keys ni servicios de pago. El despliegue autorizado comprende Auto-Deploy de Render tras el push a `main` y únicamente Hosting mediante `bunx firebase-tools deploy --only hosting --project sistemagestionpermanencia --config firebase.json --non-interactive`. No se despliegan reglas, índices ni Functions; no se modifican workflows, variables de Render ni datos existentes. Las condiciones UPME siguen requiriendo aclaración antes de indexación o almacenamiento permanente masivo; esta versión consulta bajo demanda y solo mantiene caché temporal. La disponibilidad y actualización dependen de la fuente. La recepción de una imagen no garantiza que todos los datos sean actuales.

Archivos nuevos: `shared/geography.ts`; `Backend/src/services/geography/{catalog,intent,http,validation,places,geography.service}.ts`; `Backend/src/routes/geography.routes.ts`; `Backend/src/jobs/verify-geography.ts`; `Frontend/src/services/geographyService.ts`; `Frontend/src/components/maps/{ContextualEnergyMap,MapRenderer,MapFilters,MapLegend,GeographicFeatureDialog,MapBoundary}.tsx` y `maps.css`; pruebas de backend/integración/fixtures y `tests/e2e/geography.spec.ts`.

Archivos existentes modificados: `Backend/src/app.ts` (montaje protegido); `Backend/package.json` (comando y bundle diagnóstico); `Frontend/src/pages/SearchPage.tsx` (módulo complementario lazy); `tsconfig.tools.json` (comprobación de tests); README raíz y backend. No cambia `EnergyMap.tsx` del dashboard.
