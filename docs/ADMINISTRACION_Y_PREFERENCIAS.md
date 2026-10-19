# Encuesta, roles y administración

Actualización incremental: 15 de septiembre de 2026. Se conserva React/Vite, Express/Bun, Firebase Authentication y Cloud Firestore. No se reemplazan XM, MinEnergía ni el catálogo editorial de CREG.

## Estructura conservada

| Ruta de Firestore | Contenido | Quién consulta desde la app |
|---|---|---|
| `profiles/{uid}` | Nombre, intereses anteriores, preferencias, rol y estado de encuesta | Propietario y administradores |
| `profiles/{uid}/interactions/{eventId}` | Eventos históricos y nuevos | Administradores |
| `userMetrics/{uid}` | Contadores por usuario, calculados por el backend | Administradores |

No se creó otra colección `users` ni se trasladaron eventos. Cambiar esos nombres habría obligado a migrar datos sin aportar una mejora para esta etapa. El correo, la fecha de creación de cuenta y el último acceso se consultan en Authentication; no se duplican en los perfiles.

La inspección inicial encontró 3 cuentas, 2 perfiles y 78 eventos. El script de preparación completó los campos ausentes y creó el perfil faltante. No asignó privilegios administrativos ni eliminó interacciones.

## Campos nuevos del perfil

Ejemplo de estructura, sin credenciales:

```ts
{
  userId: "uid-asignado-por-firebase",
  name: "Nombre del usuario",
  interests: [], // Se conserva el campo anterior y sus valores.
  preferences: {
    compactMetrics: false, // Preferencia visual existente.
    topics: ["energy_communities", "renewable_energy"],
    formats: ["education"]
  },
  role: "user",
  onboardingCompleted: false,
  createdAt: /* fecha existente o fecha de creación */,
  updatedAt: /* hora del servidor */
}
```

Los identificadores de temas y formatos están en [shared/preferences.ts](../shared/preferences.ts). El campo `preferences` ya era un objeto, por eso se amplió en lugar de sustituirlo por un arreglo. Los intereses anteriores sirven como sugerencias iniciales y permanecen guardados.

## Cómo funciona la encuesta

1. Firebase Authentication crea la cuenta y entrega el uid.
2. El perfil se crea mediante una transacción con `role: "user"` y `onboardingCompleted: false`.
3. La navegación espera la sesión y el perfil; lleva a `/bienvenida` mientras la encuesta no esté completa.
4. Se exige al menos un tema. La selección de tipos de contenido es opcional.
5. Una escritura guarda `preferences.topics`, `preferences.formats` y `onboardingCompleted: true`.
6. Se intenta registrar `COMPLETE_ONBOARDING` y se entra al dashboard.

Las cuentas existentes sin encuesta también la completan una vez. Los intereses previamente guardados se muestran como sugerencias. Cerrar y abrir sesión no repite una encuesta ya completada. Ante un error al recuperar el perfil se ofrece reintentar o cerrar sesión; el fallo no permite acceder a administración.

Mi perfil muestra nombre, correo, inicial, fecha de registro, preferencia visual e intereses declarados. “Editar mis preferencias” actualiza los temas y formatos y registra `SELECT_PREFERENCES`. Ya no consulta estadísticas ni muestra eventos.

## Configurar las dos cuentas de desarrolladores como administradores

Este procedimiento requiere una persona con permisos administrativos en el proyecto Firebase. No se hace desde el navegador de Visual Community:

1. Abre Firebase Console y selecciona `sistemagestionpermanencia`.
2. En **Authentication → Usuarios**, identifica por su correo cada una de las dos cuentas de desarrolladores y copia su **UID**. Evita usar el correo como nombre del documento.
3. En **Firestore Database → Datos → profiles**, abre el documento cuyo identificador coincide con ese UID.
4. Cambia exclusivamente el campo de tipo string `role` de `user` a `admin`. Conserva los demás campos y la subcolección `interactions`.
5. Repite el paso para la segunda cuenta.
6. Entra a Visual Community. Si su encuesta sigue pendiente, complétala una vez. La opción **Administración** aparecerá en el menú.

El perfil se escucha en tiempo real; el cambio de rol no requiere emitir un token especial. Para retirar permisos, cambia `role` a `user`. El backend vuelve a leer ese campo en cada petición administrativa, incluso si tiene resultados de métricas en caché.

No se asignaron roles a cuentas reales por suposición. Las pruebas administrativas elevan temporalmente cuentas desechables creadas por la suite, y las eliminan al finalizar.

Si otra instalación tiene cuentas sin perfil, primero revisa y luego aplica:

```powershell
bun run --cwd Backend scripts/prepare-profiles.ts
bun run --cwd Backend scripts/prepare-profiles.ts --apply
```

Sin `--apply` solo informa cuántos perfiles necesitan campos. Con `--apply` crea o completa esos campos: conserva roles existentes, fechas originales, intereses y eventos. No es necesario ejecutarlo en cada arranque.

## Nuevas rutas y controles

| Ruta | Acceso |
|---|---|
| `/bienvenida` | Usuario autenticado con encuesta pendiente |
| `/admin` | Perfil admin con encuesta completa |
| `/admin/usuarios/:uid` | Detalle administrativo de una cuenta |
| `GET /api/admin/summary` | Sesión Firebase válida y rol admin verificado por el backend |
| `GET /api/admin/users?offset=0` | Lo mismo; páginas de 20 cuentas |
| `GET /api/admin/users/:uid` | Lo mismo; preferencias, contadores y hasta 20 eventos |
| `GET /api/profile/metrics` | Ruta anterior conservada para compatibilidad, ahora exclusiva de admin |

Una cuenta normal que escribe `/admin` vuelve al inicio con un aviso. Las peticiones directas a las APIs administrativas reciben 403. Sin sesión reciben 401.

En Firestore:

- El usuario puede leer su perfil, modificar nombre y preferencias y crear sus propios eventos.
- Crear un perfil como admin, cambiar o eliminar su rol y borrar/recrear el perfil desde el cliente están prohibidos.
- La encuesta requiere temas válidos y no puede volver a incompleta una vez finalizada.
- El cliente normal no lee historiales ni métricas internas, ni siquiera los propios; solo los administradores pueden consultarlos.
- Los administradores pueden leer perfiles y eventos, pero tampoco editar eventos, alterar roles o escribir métricas desde el cliente.
- Las escrituras de roles se hacen en Console o en un backend administrativo autorizado.
- Firebase Admin omite las reglas de cliente. Por eso las rutas de Express comprueban sesión y rol antes de llamar a los servicios.
- Las reglas no permiten lecturas ni escrituras anónimas.

Las reglas locales ya se probaron y se publicaron en el proyecto real. Para otra instalación:

```powershell
bun run --cwd Backend scripts/deploy-firestore.ts
```

## Métricas administrativas y lecturas

El panel muestra:

- Total de cuentas registradas en Authentication, excluyendo administradores.
- Interacciones, consultas de contenido e inicios de sesión de usuarios normales. Todos los indicadores y la lista excluyen perfiles con rol `admin`.
- Usuarios con actividad registrada en los últimos 7 días.
- Hasta 20 eventos recientes del conjunto de perfiles.
- Tipos de eventos más frecuentes en una **muestra de hasta 20 eventos por perfil**.
- Lista de usuarios, preferencias, registro, último acceso informado por Authentication y número de interacciones.
- Detalle individual con sus contadores y hasta 20 eventos.

Los totales usan consultas `count()` sobre el historial; no se calculan únicamente a partir de los 20 eventos visibles. Las frecuencias sí corresponden a la muestra y la interfaz lo indica.

Los resultados se reutilizan durante 60 segundos y se procesan hasta cuatro cuentas simultáneamente. La lista entrega 20 usuarios por página. No se descargan todos los eventos históricos ni se añaden índices compuestos. Las consultas de grupo filtradas por tipo requieren índices que no están habilitados; se reutilizan los índices de las subcolecciones.

En una base de usuarios grande, el coste de actualizar el resumen crece con el número de perfiles. La siguiente etapa debe incorporar agregados incrementales o un procesamiento programado con sus índices. Esta versión no crea un motor de permanencia, clasificación ni IA. Los eventos declarados por el cliente no constituyen una prueba antifraude.

## Comunidades: enlace público y detalle

Se volvió a consultar el esquema real de `CE_27.06` y una respuesta de registros. No se encontró un campo identificado como URL pública individual verificable ni una plantilla oficial para convertir FID en una página pública.

- El backend continúa usando el mismo [servicio ArcGIS del Ministerio](https://arcgisenterprise.minenergia.gov.co/server/rest/services/Comunidades_Energ%C3%A9ticas/MapServer/0).
- Solicita nombre, departamento, municipio, estado, geometría y los campos públicos de zona, operador y ejecutor cuando estén disponibles.
- No solicita los campos de representantes, teléfonos, correos, identificación o características personales.
- “Ver información” abre un modal con los datos publicados; los campos ausentes se omiten o se explican.
- La ubicación se muestra como latitud/longitud publicadas. No se inventa una dirección ni se promete precisión adicional.
- “Consultar fuente oficial” abre el [portal institucional de comunidades energéticas](https://www.minenergia.gov.co/es/comunidades-energeticas/), con atribución al Ministerio.
- Se siguen registrando `VIEW_ENERGY_COMMUNITY` y `CLICK_EXTERNAL_SOURCE` con uid, contenido y fuente.
- El endpoint técnico queda en el código y esta documentación; no es un enlace visible de fuente original.

## Ejecutar y verificar

No se instalaron dependencias nuevas. Bun sigue siendo el runtime del backend y está disponible mediante los scripts de npm:

```powershell
npm run dev
npm run typecheck
npm run test
npm run build
```

URL local: http://localhost:5173. Si ya está iniciado, no abras otra instancia sobre los mismos puertos.

Reglas en un proyecto demo aislado:

```powershell
npm run test:rules
```

Flujos sobre Firebase real, con la aplicación en ejecución:

```powershell
$env:VC_E2E_REAL = 'true'
npm run test:e2e:running
Remove-Item Env:\VC_E2E_REAL
```

Las cuentas desechables de las pruebas se crean con correos `vc-...@example.invalid`, se verifican por uid y correo y se eliminan junto con sus propios eventos. Nunca se borran cuentas de desarrolladores ni su seguimiento. La ejecución de reglas usa emuladores; la aplicación normal y las pruebas reales de navegador usan Firebase real.

Los resultados finales y sus límites se registran en [VERIFICACION.md](VERIFICACION.md).

### Corrección: actividad de participantes y cierre de sesión

La barra superior incluye un botón visible «Cerrar sesión», también en Administración y en móvil. Usa el cierre de sesión existente y conserva el evento LOGOUT.

El resumen, los usuarios activos, las frecuencias, la actividad reciente y la lista paginada excluyen todas las cuentas cuyo rol actual sea `admin`. El detalle administrativo de estas cuentas devuelve 404. Sus eventos permanecen guardados. Los roles se consultan antes de reutilizar el resumen en caché, por lo que una promoción cambia inmediatamente qué perfiles se incluyen en la siguiente consulta. No se modificaron colecciones ni reglas de Firestore.

Verificación de esta corrección: `npm run typecheck`, `npm test` (17 pruebas) y `npm run build` correctos. El flujo administrativo pasó en Edge de escritorio y móvil con Firebase real y cuentas temporales: salida visible, LOGIN/LOGOUT conservados, exclusión del administrador en lista y actividad, rechazo de su detalle y revocación de acceso. La prueba móvil se corrigió para esperar la ruta recuperada después del login; inicialmente esperaba incorrectamente el dashboard.
