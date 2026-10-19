# Backend de Visual Community

API Express 5 ejecutada con Bun. Conserva rutas, controladores, servicios separados y modelos compartidos en ../shared.

Firebase Admin valida los ID tokens de Firebase Authentication. Registro y login suceden en el frontend mediante Firebase; las antiguas rutas POST responden 410. Las rutas administrativas comprueban el rol antes de entregar datos.

## Ejecutar desde esta carpeta

```powershell
bun install --frozen-lockfile
bun run dev
bun run typecheck
bun run build
bun run start
```

Configura .env siguiendo .env.example. En local se admite la cuenta privada existente; en Cloud Run se utiliza la identidad del servidor mediante ADC. No publiques el archivo privado.

## Servicios

MinEnergía: lista y mapa ArcGIS, enlaces públicos validados. CREG: catálogo de documentos oficiales. XM: generación, demanda y precio de bolsa. Algolia: búsqueda, candidatos y enriquecimiento del perfil. Gemini: único proveedor del chat, con modelo configurable. Administración: métricas e historial con acceso restringido.

La clave Algolia Admin se utiliza solo en indexación y no debe configurarse en el contenedor público. Las recomendaciones usan la clave de búsqueda.

## Herramientas

bun run verify:integrations --map --gemini comprueba servicios reales sin escribir documentos ni índices; --gemini consume una generación.

bun scripts/index-content.ts --dry-run revisa el catálogo sin publicarlo. Los scripts de preparación de perfiles y publicación de reglas son herramientas administrativas; no se ejecutan durante el arranque ni el despliegue.

Ver [producción](../docs/PRODUCCION.md), [personalización](../docs/PERSONALIZACION_ALGOLIA.md) y [auditoría](../docs/AUDITORIA_PRODUCCION.md).
