# Inventario de esta etapa

Se conservó React/Vite, Express/Bun, Firebase Authentication, Firestore, perfiles, roles y servicios oficiales. No hubo migración ni borrado de eventos.

## Archivos creados

- shared/discovery.ts
- Backend/src/services/minenergia/map.service.ts
- Backend/src/services/discovery/catalog.service.ts
- Backend/src/services/discovery/algolia.service.ts
- Backend/src/services/discovery/indexing.service.ts
- Backend/src/services/discovery/interest.service.ts
- Backend/src/services/discovery/popularity.service.ts
- Backend/src/services/discovery/recommendation.service.ts
- Backend/src/services/chat/retrievalService.ts
- Backend/src/services/chat/openaiService.ts
- Backend/src/services/chat/chatService.ts
- Backend/src/routes/discovery.routes.ts
- Backend/src/routes/chat.routes.ts
- Backend/scripts/index-content.ts
- Backend/tests/discovery.test.ts
- Frontend/src/services/discoveryService.ts
- Frontend/src/components/EnergyMap.tsx
- Frontend/src/components/Recommendations.tsx
- Frontend/src/components/ContentResults.tsx
- Frontend/src/components/ChatWidget.tsx
- Frontend/src/pages/SearchPage.tsx
- scripts/check-client-secrets.mjs
- docs/MAPA_BUSQUEDA_Y_ASISTENTE.md
- docs/CAMBIOS_DESCUBRIMIENTO.md

## Archivos modificados

- Backend/package.json y Backend/bun.lock: SDK algoliasearch y openai.
- Frontend/package.json y Frontend/bun.lock: Leaflet, React Leaflet y tipos.
- Backend/.env.example: nombres de variables, sin claves.
- Backend/src/app.ts: rutas privadas y límite JSON de 24 KiB para historial acotado.
- Backend/src/routes/energy.routes.ts: endpoint del mapa.
- Backend/scripts/test-support.ts: limpieza de perfiles de intereses de cuentas temporales.
- Backend/tests/auth.test.ts: acceso anónimo rechazado en rutas nuevas.
- shared/models.ts, shared/admin.ts, shared/preferences.ts: eventos, etiquetas y clasificación de temas.
- firestore.rules: eventos nuevos y colección derivada protegida.
- Frontend/src/App.tsx: /buscar.
- Frontend/src/components/Layout.tsx: búsqueda y chatbot globales.
- Frontend/src/pages/Dashboard.tsx: recomendaciones y mapa.
- Frontend/src/pages/PrivacyPage.tsx: tratamiento de búsquedas y preguntas.
- Frontend/src/services/api.ts: espera específica de descarga del mapa.
- Frontend/src/services/energyService.ts: lectura del mapa.
- Frontend/src/services/interactionService.ts: categoría y longitud, sin texto libre.
- Frontend/src/styles.css: estilos coherentes y responsive.
- tests/e2e/platform.spec.ts: nuevos flujos y compatibilidad de selectores.
- tests/firestore.rules.test.ts: privacidad y protección del perfil derivado.
- README.md, Backend/README.md: instrucciones actualizadas.

## Artefactos de comprobación

- artifacts/content-index-preview.json: cantidades y ejemplo público del catálogo, sin usuarios.
- artifacts/discovery-map-desktop.png y discovery-map-mobile.png.
- artifacts/discovery-chat-desktop.png y discovery-chat-mobile.png.
- Frontend/dist: build local.
- playwright-report y test-results: ejecución de pruebas.
- artifacts/pre-discovery: copias .snapshot de archivos antes de editarlos; no son código activo ni tests ejecutables.

Los archivos privados .env y la cuenta de servicio existente no se reemplazaron.
