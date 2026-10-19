# Revisión de estructura y duplicaciones

19 de octubre de 2026. Inspección anterior a las eliminaciones de esta revisión. Se revisaron archivos propios, referencias, comandos, imports, consumidores de configuración y hashes, excluyendo dependencias instaladas, artefactos generados y secretos. Los 156 archivos propios revisados no contenían copias con contenido idéntico; sí había reglas de exclusión repetidas. No existe `.git` en la raíz ni en Frontend/Backend.

## Matriz de decisiones

| Elemento / ubicación | Función y consumidor comprobado | Necesidad y ubicación canónica | Decisión, evidencia y riesgo |
|---|---|---|---|
| `package.json` en raíz | Orquesta dev/build/typecheck; instala Firebase CLI, Playwright y pruebas de reglas. | Desarrollo y pruebas globales: raíz. No se copia al contenedor. | Conservar. `scripts/dev.ts`, configuraciones Playwright y `tests/firestore.rules.test.ts` consumen esas herramientas. Eliminarlo rompería comandos y pruebas. |
| `Backend/package.json` | Declara Express, Firebase Admin, Gemini, Algolia y compilación Bun. | Desarrollo y producción API: Backend. Docker copia este manifiesto. | Conservar. Es el paquete del servidor, no una copia del manifiesto raíz. |
| `Frontend/package.json` | Declara React, Firebase cliente, Leaflet, Vite y compilación web. | Desarrollo y build web: Frontend. Hosting recibe solo dist. | Conservar. Sus dependencias y scripts son distintos de la API. |
| Tres `bun.lock` | Fijan las versiones de cada paquete independiente. | Cada lock junto a su package.json. Desarrollo/build reproducible. | Conservar. Instalaciones con `--cwd` y Docker `--frozen-lockfile` usan el lock correspondiente. Unificarlos requeriría migrar a workspaces; no es necesario para esta limpieza. |
| Tres `node_modules` | Resolución local de dependencias de raíz/API/web. | Directorios generados junto a cada manifiesto. No versionar. Docker instala sus propias dependencias Linux. | Conservar instalación local. Firebase raíz sirve a pruebas; Firebase web sirve al navegador. TypeScript backend/web compila paquetes diferentes. La repetición de paquetes transitivos no es código huérfano. |
| `.gitignore`, `Backend/.gitignore` | Exclusiones Git globales y plantilla local del backend. | Un único `.gitignore` en raíz es suficiente en este proyecto sin repositorio backend independiente. | Consolidar: trasladar las excepciones específicas del backend con alcance `/Backend/**/`, conservar las protecciones globales y eliminar el archivo subordinado. Riesgo bajo, comprobar con Git real en repositorio temporal sin secretos. |
| `firebase.json` | Configura Hosting, emuladores y apunta a reglas/índices. Consumido por Firebase CLI y `deploy/frontend.ps1`. | Raíz; herramienta de desarrollo/despliegue, no runtime API. | Conservar. No hay segunda configuración Firebase propia en Backend. |
| `firestore.rules`, `firestore.indexes.json` | Permisos e índices declarativos. `firebase.json`, pruebas de reglas y scripts administrativos los referencian. | Raíz, única fuente canónica. | Conservar sin modificar. Índices vacíos son una configuración válida; las consultas actuales no exigen índices compuestos declarados. No hay `Backend/firestore.indexes.json`. |
| `Frontend/src/config/firebase.ts`, `Backend/src/config/firebase.config.ts` | SDK público cliente frente a SDK Admin privado; autenticación del navegador frente a verificación del servidor. | Cada capa conserva su configuración. | Conservar: no son configuraciones intercambiables ni duplicadas. |
| `scripts/`, `Backend/scripts/`, `deploy/` | Raíz: desarrollo/auditoría/verificación del conjunto. Backend: diagnóstico, indexación y administración con dependencias servidor. Deploy: publicación web/API. | Mantener esa separación. Solo herramientas, no incluidas en runtime. | Conservar todos los scripts. Sus entradas manuales, referencias documentadas y dependencias justifican su existencia; no estar importado desde app.ts no implica estar sin uso. |
| `tests/`, `Backend/tests/` | Raíz: reglas, navegador y publicación. Backend: unitarias/contratos de servicios. | Cada suite mantiene su ubicación y comandos. | Conservar. `playwright.config.ts`, `playwright.production.config.ts` y scripts test señalan explícitamente sus carpetas. |
| `tsconfig` de backend/web/herramientas | Bun/servidor, DOM/Vite y verificación de herramientas respectivamente. | Mantener cada entorno y extends existente. | Conservar. Unificarlos mezclaría tipos y entornos incompatibles. |
| `.dockerignore`, `.gcloudignore` | Mismo conjunto permitido para contexto Docker y carga Cloud Build; consumidores diferentes. | Lista canónica en `.dockerignore`; `.gcloudignore` la incluye. | Retirar lista duplicada, conservar ambos puntos de entrada. Usar `#!include:.dockerignore`, soportado por Google Cloud CLI. Comprobar expansión y exclusiones. |
| `.gitignor/`, `firebase.jso/`, `firestore.indexes.jso/`, `package.jso/` | Directorios vacíos con nombres incompletos; cero archivos, cero referencias funcionales. | Ninguna ubicación necesaria. | Eliminar solo si siguen vacíos, sin borrado recursivo. Riesgo mínimo. No confundirlos con los archivos válidos terminados en .json. |
| `Backend/firebase-service-account.json` | Credencial Admin para desarrollo/operaciones locales. Referenciada por firebase.config.ts y scripts administrativos. | Archivo privado local; producción usa identidad Cloud Run/ADC. | Conservar sin leer, imprimir ni copiar su contenido. Verificar exclusión de Git, contexto Docker y Cloud Build. |
| `dist`, reportes y artifacts | Resultados generados, pruebas y evidencia académica. | Ubicaciones actuales, excluidas de Git/deploy salvo Frontend/dist para Hosting y Backend/dist construido dentro de Docker. | Conservar; no son una segunda implementación fuente. |

Google Cloud documenta la inclusión de otro archivo de patrones en [gcloudignore](https://docs.cloud.google.com/sdk/gcloud/reference/topic/gcloudignore). La sintaxis utilizada por esta lista compartida es compatible con ambos consumidores; no se incluyen patrones avanzados exclusivos de Docker.

## Scripts administrativos conservados

- `prepare-firestore.ts`: diagnóstico de API/base; habilitación solo con opción explícita.
- `deploy-firestore.ts`: publicación deliberada de reglas; lee la fuente de raíz y respalda reglas anteriores.
- `firebase-web-config.ts`: preparación de configuración pública del cliente.
- `prepare-profiles.ts`: completa campos ausentes cuando se solicita, sin borrar perfiles.
- `index-content.ts`: indexación Algolia manual; dispone de revisión sin publicar.
- `diagnose-gemini.ts`: diagnóstico directo de Gemini.
- `check-chat.ts`: comprueba recuperación y respuesta con varias preguntas; distinto del diagnóstico directo.
- `verify-integrations.ts`: lectura de proveedores y generación opcional.
- `test-support.ts`: cuentas desechables de las suites, con comprobaciones antes de eliminarlas.

Ninguno de estos comandos administrativos se ejecuta como parte de esta limpieza. No se cambian usuarios, documentos, índices ni reglas remotas.

## Verificación posterior

Se aplicó un solo grupo de limpieza estructural, sin cambios funcionales ni de dependencias, y después se ejecutaron estas verificaciones:

| Comprobación | Resultado |
|---|---|
| `bun run test:packaging` | 3 pruebas correctas, 65 aserciones. Git real en repositorio temporal comprueba exclusiones; se verifica inclusión única de patrones y referencias Firebase. No se copian credenciales a la prueba. |
| `bun test Backend/tests` | 69 pruebas correctas, 0 fallos. Incluye autenticación, roles, recomendaciones, Gemini, fuentes, errores y producción. |
| `bun run test:rules` | 11 pruebas correctas, 0 fallos. Emuladores de proyecto demo; usuarios reales intactos. |
| `bun run typecheck:tools` | Correcto. |
| `bun run build` | Backend y frontend correctos; TypeScript incluido. Diez archivos web analizados, sin secretos detectados. |
| `bun scripts/verify-built-api.ts` | API compilada inicia en producción y rechaza acceso anónimo. Sin llamadas externas. |
| `bun run test:build-ui` | Frontend compilado servido en navegador: login, registro, redirección de /admin, ancho móvil correcto y cero errores JavaScript. |
| `./scripts/verify-container.ps1` | Imagen reconstruida y verificada: solo archivos runtime del proyecto, sin credencial local ni .env; usuario no privilegiado, seis rutas protegidas, CORS y SIGTERM correctos. Contenedor temporal eliminado. |

El primer intento de Vite y Firebase CLI estuvo limitado por permisos del entorno de ejecución; se repitieron con los permisos necesarios y finalizaron correctamente. Los servidores de comprobación se cerraron. No se repitieron las consultas a proveedores ni toda la suite E2E: no hubo cambios en el código funcional, y se mantiene el bloqueo externo del portal del Ministerio documentado en el informe de preproducción.

Google Cloud CLI no está instalado en este equipo. La inclusión de patrones se verificó según su sintaxis documentada y mediante pruebas de las exclusiones, pero el listado efectivo de carga con `gcloud meta list-files-for-upload` queda para cuando se instale la CLI. Docker sí fue construido y ejecutado localmente.

La credencial Admin se conserva en su ubicación local y está excluida por las reglas probadas. No se leyó ni imprimió su contenido durante esta revisión. No hay un repositorio Git inicializado en esta copia: la verificación confirma las exclusiones actuales, no certifica el historial de un repositorio remoto desconocido. Producción mantiene ADC con identidad Cloud Run y no copia el JSON local. La publicación remota continúa pendiente del alojamiento.

Eliminaciones efectivas: `Backend/.gitignore` (reglas consolidadas), las cuatro carpetas vacías y la lista redundante dentro de `.gcloudignore`. No se eliminaron manifiestos, locks, dependencias, scripts, pruebas funcionales ni datos. Se añadieron `tests/packaging.test.ts` y el comando `test:packaging` para detectar futuras inconsistencias.

## Estructura resultante y fuentes únicas

```text
raíz/
  package.json + bun.lock     herramientas y comandos globales
  .gitignore                 exclusiones Git de todo el proyecto
  .dockerignore              lista permitida de código para construir la API
  .gcloudignore              incluye .dockerignore
  firebase.json              Hosting, emuladores y referencias Firestore
  firestore.rules            permisos canónicos
  firestore.indexes.json     índices canónicos
  scripts/                   desarrollo y comprobación del conjunto
  tests/                     reglas, navegador, empaquetado y despliegue
  deploy/                    publicación API/web
  shared/                    modelos compartidos, sin duplicarlos entre capas
  Backend/
    package.json + bun.lock   dependencias y comandos del servidor
    src/                     API y servicios
    scripts/                 operaciones que requieren dependencias del servidor
    tests/                   contratos y pruebas de servicios
  Frontend/
    package.json + bun.lock   dependencias y comandos de React/Vite
    src/ + public/           interfaz y recursos
```

No se incorporaron workspaces ni se cambiaron los comandos de instalación. Cada `node_modules` es regenerable desde su manifiesto y lock; no debe copiarse entre Windows y el contenedor Linux. Los README de raíz y Backend tienen ámbitos diferentes (conjunto y servidor) y se conservan.
