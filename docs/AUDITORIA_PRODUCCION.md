# Auditoría de limpieza y preparación de producción

Fecha: 19 de octubre de 2026. Esta matriz se creó antes de las eliminaciones; los resultados finales están en [INFORME_PREPRODUCCION.md](INFORME_PREPRODUCCION.md).

El usuario confirmó que todavía falta habilitar el alojamiento. Se prepara el despliegue; no se publica una URL parcial ni se modifican recursos remotos.

## Evidencia antes de eliminar

| Elemento | Ubicación | Evidencia y decisión | Riesgo / verificación |
|---|---|---|---|
| Adaptador OpenAI | Backend/src/services/chat/openaiService.ts | `chatService.ts` importa Gemini. Solo discovery.test.ts y links-chat.test.ts importan el adaptador anterior; no hay rutas activas hacia él. Retirar adaptador y exclusivamente sus pruebas específicas. Conservar pruebas de contexto, recuperación y validación compartidas. | Bajo: Gemini tiene pruebas propias para configuración, SDK, contexto, 401/429, red y respuesta vacía. Ejecutar toda la suite. |
| openai | Backend/package.json y bun.lock | Único import productivo: adaptador anterior. Retirar después de actualizar pruebas. | Bajo; comprobar resolución, TypeScript y pruebas. |
| jsonwebtoken y socket-io | Backend/package.json y bun.lock | Sin imports, require, import dinámico ni referencias de ejecución en código propio, scripts o configuración. Firebase Admin verifica los tokens. | Bajo; jsonwebtoken puede permanecer transitivamente dentro de Firebase Admin, no eliminarlo manualmente de node_modules. |
| Loading y ChevronDown | Frontend/src/components/Layout.tsx; Frontend/src/pages/CommunitiesPage.tsx | TypeScript con noUnusedLocals identifica imports sin lecturas. Retirar solo los imports. | Bajo; build de frontend. |
| Parámetro layer | Backend/src/services/minenergia/minenergia.service.ts, parseCommunities | TypeScript detecta parámetro sin lecturas. Todos los invocadores revisados; el parser utiliza la fuente pública constante. Retirar parámetro y argumento redundante. | Bajo; pruebas de transformación y mapa. |
| Variables locales del entorno | Backend/.env y Frontend/.env | Inventario de nombres, sin imprimir valores: las variables existentes pertenecen a Gemini, Algolia y Firebase/web. No hay variables obsoletas confirmadas. | Conservar ambos archivos privados intactos. |
| /api/profile/metrics | Backend/src/routes/profile.routes.ts | Ruta de compatibilidad montada y cubierta por pruebas de autorización. calculateUserMetrics también es utilizado por administración. | Conservar; retirar por apariencia rompería una interfaz existente. |
| /api/auth/login, register, logout | Backend/src/routes/auth.routes.ts | Responden 410 deliberadamente para bloquear el flujo legado; pruebas verifican este rechazo. | Conservar comportamiento de seguridad. |
| Scripts de Firebase/indexación/diagnóstico | Backend/scripts; scripts | Entradas operativas manuales documentadas, aunque no se importen desde app.ts. | Conservar; no ejecutar scripts que reemplacen datos/índices durante esta limpieza. |
| Pruebas y fixtures | Backend/tests; tests | Dobles de proveedores y emuladores prueban errores, seguridad y contratos; no forman parte del bundle publicado. | Conservar, salvo pruebas exclusivas del adaptador retirado. |
| Documentación histórica y artifacts | docs; artifacts | Evidencia académica y respaldos. No son módulos de ejecución; no basta para afirmar que carecen de utilidad. | Conservar y excluir del contexto de despliegue. Actualizar guías activas. |
| Carpetas .gitignor, firebase.jso, firestore.indexes.jso, package.jso | Raíz | Se encontraron vacías; no hay motivo funcional para incluirlas en el despliegue. | Conservadas inicialmente; eliminadas posteriormente, tras volver a comprobar que estaban vacías, en la revisión de estructura solicitada por el usuario. Véase ESTRUCTURA_Y_DUPLICADOS.md. |

## Línea base

Segunda revisión: análisis de imports con el parser de TypeScript sobre 110 archivos, incluyendo imports dinámicos y reexports. Cero imports locales sin resolver. No se detectaron componentes React huérfanos: `EnergyMap` es un export default utilizado con `React.lazy`, por lo que se conserva. El reporte completo está en `artifacts/auditoria-referencias.json`.

| Elemento adicional | Evidencia | Decisión / riesgo |
|---|---|---|
| `clearAdminCache` en admin.service.ts | Análisis de referencias y búsqueda en fuentes, pruebas, scripts y documentación: solo declaración. La caché activa utiliza su TTL y no llama a este auxiliar. | Retirar función no invocada; riesgo bajo. |
| `INTERESTS` en shared/models.ts | Solo declaración; preferencias actuales usan shared/preferences.ts. El campo legacy `interests` y sus valores admitidos en reglas siguen activos. | Retirar únicamente constante exportada; conservar contratos, reglas y conversión de perfiles antiguos. |
| Entrada `/src/generated/prisma` en Backend/.gitignore | No existe Prisma, generador, dependencia, schema ni import en la copia actual. | Retirar solo esta entrada obsoleta. |
| TypeScript como peerDependency del backend | Se utiliza en compilación y análisis; Bun ejecuta el bundle JavaScript sin requerir el compilador en producción. | Reclasificar como devDependency, sin cambiar versión ni eliminar la herramienta. |

Las defensas de redacción de secretos y el escáner del bundle pueden seguir reconociendo nombres de proveedores retirados: son patrones de seguridad, no configuración ni integración activa.

- No existe repositorio `.git` en esta copia. Antes de editar se conserva una copia local del código/configuración no secreta fuera del contexto de despliegue.
- `bun run typecheck`: correcto.
- `bun test Backend/tests`: 71 pruebas correctas, 0 fallos.
- Análisis adicional con `noUnusedLocals` y `noUnusedParameters`: tres declaraciones sin uso descritas arriba.
- Docker está instalado, pero su motor no está iniciado. No se afirma que la imagen esté construida.

## Criterios

No eliminar datos, usuarios, índices, reglas ni archivos privados. No actualizar dependencias indiscriminadamente. Separar configuración de ejecución y herramientas de indexación. Publicar únicamente cuando el alojamiento y sus credenciales estén habilitados. Los resultados finales se documentarán en PRODUCCION.md y en el informe de verificación.
