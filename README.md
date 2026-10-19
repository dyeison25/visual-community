# Visual Community

Plataforma independiente sobre comunidades energéticas de Colombia: React + TypeScript + Vite, Express con Bun, Firebase Authentication, Firestore, Algolia y Gemini.

## Estado y lanzamiento

**El alojamiento todavía no está habilitado. No hay URL pública ni lanzamiento completado.** La aplicación está preparada para Firebase Hosting (web) y Cloud Run (API). No se modificaron usuarios, documentos, índices ni reglas remotas durante la limpieza.

- [Configuración y publicación](docs/PRODUCCION.md).
- [Resultados y pendientes](docs/INFORME_PREPRODUCCION.md).
- [Auditoría y evidencia de limpieza](docs/AUDITORIA_PRODUCCION.md).
- [Estructura, duplicaciones y ubicaciones canónicas](docs/ESTRUCTURA_Y_DUPLICADOS.md).

Gemini es el único proveedor activo del asistente. El adaptador antiguo de OpenAI fue retirado.

## Funcionalidades

Registro, login, logout, recuperación de acceso y sesión; encuesta inicial; perfil y preferencias; comunidades, detalle y mapa oficial; normativa CREG; indicadores XM; búsqueda, perfil de intereses y recomendaciones explicables; chat Gemini con fuentes; interacciones por uid y administración protegida.

Los registros geográficos pueden ser postulaciones, no proyectos ejecutados. CREG utiliza documentos oficiales seleccionados, no una API inventada. Las métricas internas se muestran solo a administradores.

## Instalar y ejecutar

Requisitos: Bun 1.3.13 y Node 24. Emuladores: Java 21 o posterior.

Desde la raíz:

```powershell
bun install --frozen-lockfile
bun install --cwd Backend --frozen-lockfile
bun install --cwd Frontend --frozen-lockfile
npm run dev
```

Configura Backend/.env y Frontend/.env siguiendo sus archivos .env.example, conservando tus valores existentes. No uses variables VITE para claves privadas.

La web local usa http://127.0.0.1:5173 y la API http://127.0.0.1:3000. Es necesario mantener el proceso abierto. El proxy de Vite es solo para desarrollo.

## Verificar y compilar

```powershell
bun run typecheck
bun test Backend/tests
bun run test:packaging
bun run test:rules
bun run test:e2e
bun run build
```

El build genera Backend/dist/index.js y Frontend/dist y revisa que el bundle web no contenga secretos. Desde Backend, bun run start ejecuta la API compilada. En producción exige configuración completa, CORS HTTPS y ausencia de emuladores.

Con Docker Desktop iniciado en modo Linux, `./scripts/verify-container.ps1` construye y verifica el contenedor de producción sin red externa durante la prueba, sin claves reales y sin publicar puertos. Esta comprobación local ya pasó; el despliegue remoto sigue pendiente.

bun run dev:emulators usa cuentas locales del proyecto demo. Algunas pruebas simulan fallos de proveedores; no se utilizan mocks para sustituir datos de la aplicación.

Desde Backend, bun run verify:integrations --map --gemini comprueba servicios reales con lecturas y una generación. Omitir --gemini evita ese consumo. La indexación es manual: bun scripts/index-content.ts --dry-run permite revisar el catálogo sin publicar. No reindexar como parte del despliegue.

## Documentación funcional

- [Roles y preferencias](docs/ADMINISTRACION_Y_PREFERENCIAS.md).
- [Personalización Algolia](docs/PERSONALIZACION_ALGOLIA.md).
- [Fuentes oficiales](docs/FUENTES_OFICIALES.md).
- [Gemini](docs/GEMINI.md).

Los informes anteriores se conservan como evidencia histórica. Esta versión calcula afinidad y recomendaciones; no clasifica riesgo de abandono ni envía campañas automáticas.
