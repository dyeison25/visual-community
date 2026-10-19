# Lanzamiento de Visual Community

Preparación: 19 de octubre de 2026. **El alojamiento todavía no está habilitado, según confirmó el propietario. No hay URL pública publicada ni pruebas posdespliegue realizadas.** No confundir el build local con un lanzamiento completado.

## Arquitectura que se conserva

React/TypeScript/Vite estático en Firebase Hosting; Express/TypeScript compilado para Bun en Cloud Run. Firebase Authentication y Firestore permanecen en el proyecto actual. Algolia, Gemini y las fuentes oficiales conservan sus servicios e índices. No hay migración de datos ni de tecnología.

El navegador llama directamente a `https://<API_REAL>/api`. No se usa una reescritura de Hosting hacia Cloud Run: Hosting impone 60 segundos y el mapa puede necesitar más en una carga sin caché. Cloud Run queda con timeout de 120 segundos; el frontend conserva sus límites por operación. Hosting administra HTTPS y reescribe rutas SPA hacia index.html. Los assets con hash se cachean; HTML se revalida. API: `Cache-Control: private, no-store`.

Documentación oficial: [Hosting y Cloud Run](https://firebase.google.com/docs/hosting/cloud-run), [contrato del contenedor](https://docs.cloud.google.com/run/docs/container-contract), [Bun en Docker](https://bun.sh/guides/ecosystem/docker).

## Requisitos antes de publicar

1. Habilitar facturación en el proyecto y autorizar su consumo. No se habilitó ni contrató nada durante esta preparación.
2. Instalar Google Cloud CLI, iniciar sesión y confirmar el proyecto correcto. Firebase CLI ya es una dependencia de desarrollo del repositorio.
3. Habilitar Cloud Run, Cloud Build, Artifact Registry y Secret Manager. Crear un repositorio Docker llamado `visual-community` en la región elegida, inicialmente `us-central1`.
4. Crear una identidad de ejecución dedicada. Necesita acceso a Firestore (`roles/datastore.user`) y lectura de usuarios Firebase (`roles/firebaseauth.viewer`), además de acceso a las dos versiones de secretos concretas. El backend no necesita crear usuarios ni modificar sus credenciales.
5. Configurar la identidad de compilación y permisos de publicación de imágenes según Cloud Build. La identidad del operador debe poder desplegar y asignar la identidad de ejecución. No copiar cuentas de servicio privadas dentro del contenedor.
6. En Secret Manager, crear `visual-community-gemini` y `visual-community-algolia-search` con las claves actuales. Introducirlas por la consola o un mecanismo seguro, nunca en argumentos visibles, Git o Vite. La clave de Algolia debe limitarse a búsqueda y al índice utilizado. Comprobar que permite recuperar objetos necesarios para enriquecer intereses.
7. Reservar un sitio de Firebase Hosting exclusivo para esta aplicación. Verificar los sitios existentes antes de elegir su ID; no sobrescribir otra web.
8. En Firebase Authentication → Configuración → Dominios autorizados, añadir los nombres de host de Hosting y del dominio propio, si existe. Conservar los dominios existentes. Mantener correo/contraseña habilitado.
9. Revisar restricciones de la clave pública web de Firebase para que admita esos dominios. Comprobar cuotas de Gemini y permisos de Algolia. Confirmar que las reglas remotas de Firestore coinciden con las locales; no publicar reglas automáticamente.

## Variables: nombres y destino

| Destino | Variables |
|---|---|
| API: configuración no secreta | NODE_ENV, HOST, PORT, FIREBASE_PROJECT_ID, FRONTEND_ORIGIN, GEMINI_MODEL, ALGOLIA_APP_ID, ALGOLIA_INDEX_NAME |
| API: Secret Manager | GEMINI_API_KEY, ALGOLIA_SEARCH_API_KEY |
| Indexación local/manual exclusivamente | ALGOLIA_ADMIN_API_KEY |
| Frontend: configuración pública | VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID, VITE_API_BASE_URL |
| Frontend: opcionales públicos | VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID |
| Solo desarrollo | VITE_USE_FIREBASE_EMULATORS, VITE_DEV_PORT, API_PROXY_TARGET, GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST |
| Fuentes: ajustes opcionales | MINENERGIA_LAYER_URL, XM_API_URL, EXTERNAL_TIMEOUT_MS |
| Puerta de lanzamiento | VC_RELEASE_BUILD |
| Pruebas públicas posteriores | VC_PUBLIC_FRONTEND_URL, VC_PUBLIC_API_URL, VC_SMOKE_CREATE_TEST_ACCOUNTS |

En Cloud Run, `PORT` lo proporciona el servicio y `HOST` es `0.0.0.0`. Se usa la identidad del servidor mediante ADC; no configurar un archivo JSON local como GOOGLE_APPLICATION_CREDENTIALS allí. FRONTEND_ORIGIN contiene orígenes HTTPS exactos separados por comas, sin barra final, rutas ni comodines. El modelo es configurable y debe estar habilitado en la cuenta de Gemini. Los archivos de ejemplo contienen nombres y valores de desarrollo no secretos; ninguna clave real.

## Instalar y verificar localmente

Desde la raíz, con Bun 1.3.13 y Node 24:

```powershell
bun install --frozen-lockfile
bun install --cwd Backend --frozen-lockfile
bun install --cwd Frontend --frozen-lockfile
bun run typecheck
bun test Backend/tests
bun run test:packaging
bun run test:rules
bun run test:e2e
bun run build
```

Las pruebas de reglas y E2E usan emuladores y requieren Java 21 o posterior. Las fuentes oficiales se consultan en vivo en parte de las E2E: un fallo externo debe reportarse por separado. No ejecutar suites que comparten puertos de emuladores simultáneamente.

Comprobación de proveedores, desde Backend:

```powershell
bun run verify:integrations --map --gemini
```

No escribe documentos ni índices. Lee una muestra mínima de Firebase y comprueba las reglas. `--gemini` genera una respuesta y consume cuota; omitir ese argumento evita la generación. El diagnóstico muestra estados y conteos, nunca usuarios, tokens o claves.

## Desplegar la API cuando esté habilitado el alojamiento

### Verificación local del contenedor, sin alojamiento

La imagen de producción ya se construyó y probó localmente. Para repetir la comprobación con Docker Desktop en modo Linux iniciado, ejecutar desde la raíz:

```powershell
./scripts/verify-container.ps1
```

El script descarga la base y las dependencias necesarias durante el build. Después arranca un contenedor temporal con `--network none`, sin publicar puertos ni montar archivos locales. Utiliza valores ficticios únicamente para verificar el arranque: no consulta proveedores ni sustituye la configuración de la aplicación. Comprueba usuario no privilegiado, contenido mínimo de la imagen, salud, CORS, seis rutas que exigen autenticación y cierre correcto por SIGTERM. Guarda el resultado en `artifacts/produccion-contenedor.json` y elimina su contenedor temporal; conserva la imagen `visual-community-api:local-check`. Para comprobar esa misma imagen sin reconstruirla, usar `-SkipBuild`; después de cambiar código debe hacerse el build completo.

Esta prueba no certifica la conexión a Firebase, Algolia o Gemini desde Cloud Run. Esa comprobación requiere el despliegue, su identidad y sus secretos reales.

### Publicación remota

El script `deploy/backend.ps1` utiliza Cloud Build y por eso no requiere Docker local. No crea proyectos, no habilita facturación, no cambia reglas y no crea ni reemplaza índices Algolia. Requiere los recursos y permisos anteriores.

Desde PowerShell en la raíz, asignar los parámetros no secretos del entorno habilitado y ejecutar:

```powershell
./deploy/backend.ps1 -ProjectId $projectId -RuntimeServiceAccount $runtimeIdentity -FrontendOrigin $frontendOrigins -GeminiModel $model -AlgoliaAppId $algoliaAppId
```

El script solicita compilación de la imagen y despliega `visual-community-api`. Devuelve su URL real; guardarla en `$apiUrl`. Las claves se resuelven desde Secret Manager. El contenedor incluye únicamente dependencias de ejecución y el bundle del backend; `.dockerignore` y `.gcloudignore` utilizan listas permitidas. No entran `.env`, credenciales, scripts de pruebas, documentos ni artifacts.

La lista permitida se mantiene únicamente en `.dockerignore`; `.gcloudignore` la reutiliza mediante `#!include:.dockerignore`. No mantener una segunda copia de patrones. Antes del despliegue puede comprobarse el listado real con `gcloud meta list-files-for-upload` desde la raíz; no ejecutar ese comando desde Backend. Las exclusiones Git se mantienen únicamente en el `.gitignore` raíz.

La API permite invocación HTTP pública porque el navegador debe alcanzarla; cada ruta de datos verifica el token de Firebase y las administrativas verifican además el rol. El endpoint de salud es público. No confundir invocación de Cloud Run con autorización a datos.

La configuración inicial usa 512 MiB, una CPU, concurrencia 20 y máximo una instancia. Los límites por uid y cachés son locales a cada proceso: una revisión nueva o un reinicio reinicia sus contadores. Antes de escalar se debe compartir el limitador; esta versión no ofrece una cuota global estricta. Instancias mínimas cero permite arranque en frío: la URL permanece asignada, aunque la instancia pueda detenerse por inactividad. La disponibilidad depende del servicio, cuotas y facturación.

## Desplegar la web

Configurar las variables públicas de Firebase en Frontend/.env o en el entorno del build. El proyecto debe ser el mismo que utiliza la API. No introducir claves privadas en variables VITE.

```powershell
./deploy/frontend.ps1 -ProjectId $projectId -HostingSiteId $hostingSiteId -ApiUrl $apiUrl
```

`ApiUrl` es el origen HTTPS real, sin `/api`; el script añade ese sufijo al build. Activa VC_RELEASE_BUILD, compila ambas partes, revisa secretos y publica **solo Hosting** en el sitio explícito. No despliega Firestore ni cambia dominios de Authentication por su cuenta. El sitio tendrá `https://<ID_REAL>.web.app`; esto describe el formato, no una URL ya publicada.

## Validación obligatoria después de publicar

Primero comprobar salud de la API, navegación directa a /login, /comunidades y /admin, HTTPS, carga móvil y ausencia de errores de CORS. No dar el lanzamiento por aprobado solo con HTTP 200 en salud.

Hay una suite específica para el bundle publicado; no importa módulos de `/src` desde el navegador:

```powershell
$env:VC_PUBLIC_FRONTEND_URL = $frontendUrl
$env:VC_PUBLIC_API_URL = $apiUrl
$env:VC_SMOKE_CREATE_TEST_ACCOUNTS = 'true'
bun run test:production
```

Necesita la cuenta administrativa local de verificación en la ruta ya usada por el proyecto. Crea cuentas desechables `vc-…@example.invalid`, verifica registro, encuesta, persistencia, preferencias, mapa, comunidades, normativa, indicadores, búsqueda, generación Gemini, logout/login, restricciones y panel administrativo. Cambia el rol únicamente de una cuenta creada por la propia prueba. El helper verifica uid y correo antes de eliminar exclusivamente sus datos temporales. No se guardan trazas, videos ni capturas de participantes reales. Consume cuota real; no ejecutarla contra un proyecto distinto del configurado.

Si una prueba falla, conservar la revisión previa de Hosting y Cloud Run. Revertir tráfico a una revisión anterior no requiere revertir ni borrar Firestore, usuarios o índice Algolia. No automatizar una reindexación durante un rollback.

## Estado de esta entrega

Consultar `INFORME_PREPRODUCCION.md` para resultados y limitaciones. Las URLs, el build remoto de la imagen y todas las verificaciones posdespliegue siguen pendientes hasta que el propietario habilite alojamiento y permisos.
