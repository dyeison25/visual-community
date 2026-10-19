# Fuentes oficiales e integración

Investigación inicial: 7 de septiembre de 2026. Esquema y enlaces de MinEnergía revisados de nuevo el 15 de septiembre de 2026. Se consultaron respuestas reales; no se extrajo HTML para alimentar la aplicación.

## Ministerio de Minas y Energía

**Corrección del 21 de septiembre de 2026:** la ruta `/es/comunidades-energeticas/` respondió 404 y se dejó de utilizar. El respaldo temático y su validación están documentados en [Enlaces y activación del chat](ENLACES_Y_ACTIVACION_CHAT.md). No se encontró una ficha web individual en la capa. Se observó además bloqueo de navegadores automatizados por el Ministerio, aunque las páginas alternativas responden correctamente al servidor.

Directorio REST oficial descubierto:
https://arcgisenterprise.minenergia.gov.co/server/rest/services

Capa utilizada:
https://arcgisenterprise.minenergia.gov.co/server/rest/services/Comunidades_Energ%C3%A9ticas/MapServer/0

La capa se identifica como `CE_27.06`, contiene geometría de puntos y permite `Query`. La consulta inicial devolvió 17.499 registros; ese número es una observación de la investigación, no una cifra fijada en la interfaz.

Peticiones HTTP GET:

```text
{layer}?f=pjson
{layer}/query?f=json&where=1%3D1&returnIdsOnly=true
{layer}/query?f=json&objectIds=0,1&outFields=FID,Nombre_de_,Departamen,Municipio,Estado,Rural___Ur,Operador_d,Ejecutor&returnGeometry=true&outSR=4326
```

- La primera petición inspeccionó metadatos.
- La aplicación obtiene identificadores y consulta grupos de 24.
- La capa responde `Pagination is not supported` a `resultRecordCount/resultOffset`; por eso no se simula soporte de paginación.
- La búsqueda aplica `UPPER(... ) LIKE` sobre nombre, departamento y municipio. Se acota la longitud y se escapan comillas.
- Solo se solicitan los campos indicados. Se excluyen correos, representantes, teléfonos y otros datos personales presentes en el esquema.
- “Ver información” abre un modal con nombre, territorio, estado publicado, coordenadas válidas y los campos públicos adicionales disponibles: zona, operador y ejecutor.
- No se identificó una URL pública individual verificable en el esquema. “Consultar fuente oficial” resuelve un respaldo público del Ministerio validado por HTTP; el endpoint JSON permanece como implementación interna.
- La apertura del detalle y del enlace oficial conserva sus eventos de interacción con uid, contenido y fuente.
- Los registros incluyen **postulaciones**. No se etiquetan como proyectos ejecutados ni como comunidades formalmente inscritas en el RCE.
- Caché de identificadores y páginas: 15 minutos. Fallos: estado no disponible sin sustituirlo por datos inventados.

Los artículos institucionales son resúmenes editoriales de recursos del portal (estrategia, manual y registro), con fecha de revisión y sin fecha de publicación inventada. El portal también enlaza normativa, incluido el Decreto 2236 de 2023. La interfaz atribuye ese contenido al Ministerio de Minas y Energía.

## XM / Sinergox

Documentación primaria, enlazada desde XM:
https://github.com/EquipoAnaliticaXM/API_XM

Comunicación oficial sobre uso obligatorio de HTTPS:
https://www.xm.com.co/noticias/8194-actualizacion-en-el-protocolo-de-acceso-la-api-de-bi-sinergox

Consulta de inventario efectivamente utilizada para verificar las variables:

```http
POST https://servapibi.xm.com.co/lists
Content-Type: application/json

{"MetricId":"ListadoMetricas"}
```

Endpoint de producción utilizado por la app:

```http
POST https://servapibi.xm.com.co/hourly
Content-Type: application/json

{
  "MetricId": "Gene",
  "Entity": "Sistema",
  "StartDate": "YYYY-MM-DD",
  "EndDate": "YYYY-MM-DD"
}
```

La ventana se calcula diariamente: los 14 días anteriores a hoy según America/Bogota. Sin claves ni registro para esta API pública.

| MetricId | Tarjeta | Unidad original | Transformación |
|---|---|---|---|
| Gene | Generación real | kWh | Suma de 24 horas / 1.000.000 → GWh |
| DemaReal | Demanda de energía | kWh | Suma de 24 horas / 1.000.000 → GWh |
| PrecBolsNaci | Precio de bolsa | COP/kWh | Promedio aritmético de 24 horas |

Se valida `Metric.Id`, `Items`, fecha, entidad Sistema y valores `Hour01...Hour24`. Los nulos, cadenas vacías y horas ausentes nunca se convierten en cero. Los ceros numéricos publicados por XM sí se conservan. Se omiten días con menos de 24 valores numéricos; esto no garantiza que el publicador haya cerrado o dejado de revisar esos datos.

Cada métrica muestra su última fecha disponible, su unidad y una serie diaria. Las fechas de las métricas pueden diferir. El precio no es una tarifa residencial ni el resultado de una comunidad. Se muestran tarjetas, gráfico accesible con títulos, leyenda y tabla de valores.

Las tres consultas son independientes; una falla no descarta las otras. Caché: 5 minutos. Timeout: 12 segundos por petición por defecto. El enlace institucional visible es https://sinergox.xm.com.co/.

## CREG

Fuentes revisadas:

- Página solicitada: https://creg.gov.co/loader.php?lServicio=Documentos&lFuncion=infoCategoriaConsumo&tipo=RE
- Gestor oficial: https://gestornormativo.creg.gov.co/gestor/
- Publicaciones de datos abiertos y resultados del portal datos.gov.co.
- Resoluciones en HTML/PDF del Gestor Normativo Alejandría.

**No se identificó una API pública documentada, feed o conjunto estructurado adecuado de resoluciones CREG.** Parte del portal principal no respondió a las herramientas de consulta. Esta conclusión describe el alcance de la investigación, no afirma que no pueda existir ningún servicio interno o futuro.

No se confunde el gestor HTML con una API. Tampoco se toma un inventario de activos de información ni datos de la CRA (otra entidad) como catálogo de resoluciones CREG.

Se implementó un proveedor `RegulationProvider` reemplazable, actualmente editorial y marcado `status: curated`. Contiene referencias verificadas:

| Documento | Fecha del acto | Fuente original |
|---|---|---|
| CREG 101 087 de 2025 | 2025-10-30 | https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_creg_101-87_2025.htm |
| CREG 101 072 de 2025 | 2025-04-06 | https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_creg_101-72_2025.htm |
| CREG 174 de 2021 | 2021-10-07 | https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_creg_0174_2021.htm |

La fecha es la del acto, no la de carga al gestor ni la de publicación del Diario Oficial. Cada ficha muestra tipo, resumen propio, fuente y enlace. No se afirma automáticamente su vigencia actual; se invita a consultar modificaciones en Alejandría.

Alternativa futura correcta: solicitar a CREG un feed/dataset/API oficial con contrato de datos, o mantener un catálogo editorial versionado y revisar sus enlaces y modificaciones. Al existir un servicio verificable, reemplazar el proveedor sin cambiar la UI. **No hay scraping ni endpoints inventados.**

## Contrato interno y comportamiento ante fallos

Las rutas internas bajo `/api/energy` requieren ID token Firebase:

- `GET /articles`: contenidos institucionales revisados.
- `GET /communities?offset=0&q=`: capa ArcGIS.
- `GET /regulations`: catálogo CREG.
- `GET /metrics`: tres métricas XM.

Los servicios devuelven `SourceResult<T>`: datos, fuente, enlace, estado, fecha de consulta/revisión y mensaje opcional. Los modelos compartidos están en `shared/models.ts`.

La UI solo utiliza los servicios del frontend. El backend realiza las peticiones oficiales y valida sus respuestas. No se requieren permisos CORS de las fuentes externas. Ninguna caída externa interrumpe la autenticación, el perfil o las demás secciones.
